-- Sunny POS — mejoras al modelo heredado del piloto (nivel A del plan: sin cambios en la app).
-- generar_estructura.py las agrega al final de 01_estructura.sql, dentro de la misma transacción.
-- Idempotente: se puede volver a correr sobre una base ya instalada.

-- ---------------------------------------------------------------------------
-- Tabla sin uso (ni la app ni ninguna función la lee o escribe)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.usage_log;

-- ---------------------------------------------------------------------------
-- products: valores vacíos → valor seguro antes de guardar.
-- Importar, Deshacer y Duplicar mandan a veces null o '' en estos campos;
-- normalizarlos aquí permite exigirlos sin romper esos caminos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.te_products_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.featured      := COALESCE(NEW.featured, false);
  NEW.is_published  := COALESCE(NEW.is_published, false);
  NEW.is_archived   := COALESCE(NEW.is_archived, false);
  NEW.out_of_stock  := COALESCE(NEW.out_of_stock, false);
  NEW.is_apartado   := COALESCE(NEW.is_apartado, false);
  NEW."position"    := COALESCE(NEW."position", 0);
  NEW.created_at    := COALESCE(NEW.created_at, now());
  NEW.updated_at    := COALESCE(NEW.updated_at, now());
  NEW.barcode       := NULLIF(btrim(NEW.barcode), '');
  NEW.supplier_code := NULLIF(btrim(NEW.supplier_code), '');
  NEW.badge_type    := NULLIF(btrim(NEW.badge_type), '');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.te_products_normalize() FROM PUBLIC, anon, authenticated;

-- Corre antes que te_products_0_stock_sync_trg (orden alfabético de triggers BEFORE)
DROP TRIGGER IF EXISTS te_products_00_normalize_trg ON public.products;
CREATE TRIGGER te_products_00_normalize_trg BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.te_products_normalize();

ALTER TABLE public.products
  ALTER COLUMN featured SET NOT NULL,
  ALTER COLUMN is_published SET NOT NULL,
  ALTER COLUMN is_archived SET NOT NULL,
  ALTER COLUMN out_of_stock SET NOT NULL,
  ALTER COLUMN is_apartado SET NOT NULL,
  ALTER COLUMN "position" SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  -- Lo que se crea sin decir lo contrario nace oculto (el piloto nacía publicado)
  ALTER COLUMN is_published SET DEFAULT false;

-- ---------------------------------------------------------------------------
-- Reglas que antes solo cuidaba la pantalla
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_price_check CHECK (price >= 0);
  ALTER TABLE public.products ADD CONSTRAINT products_original_price_check CHECK (original_price IS NULL OR original_price >= 0);
  ALTER TABLE public.products ADD CONSTRAINT products_cost_check CHECK (cost IS NULL OR cost >= 0);
  -- Caja no vende de más (abre "Reabastecer"): un stock negativo sería un error, mejor que falle
  ALTER TABLE public.products ADD CONSTRAINT products_stock_check CHECK (stock >= 0);
  ALTER TABLE public.products ADD CONSTRAINT products_badge_type_check CHECK (badge_type IS NULL OR badge_type IN ('best','new','promo','natura'));
  ALTER TABLE public.sales ADD CONSTRAINT sales_total_check CHECK (total >= 0);
  ALTER TABLE public.sales ADD CONSTRAINT sales_discount_check CHECK (discount IS NULL OR discount >= 0);
  ALTER TABLE public.sales ADD CONSTRAINT sales_saldo_favor_check CHECK (saldo_favor >= 0);
  ALTER TABLE public.cash_shifts ADD CONSTRAINT cash_shifts_fondo_check CHECK (fondo_inicial >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Código de barras único (el formulario ya lo bloqueaba; ahora también Importar y el servidor)
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products (barcode) WHERE barcode IS NOT NULL;

-- Fechas que siempre deben existir (todas tienen DEFAULT now(); nadie las manda vacías)
ALTER TABLE public.sales ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.activity_log ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.recently_edited ALTER COLUMN edited_at SET NOT NULL;
ALTER TABLE public.config ALTER COLUMN updated_at SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Índices para las consultas reales de la app
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sales_customer_id_idx    ON public.sales (customer_id) WHERE customer_id IS NOT NULL;   -- historial de una clienta
CREATE INDEX IF NOT EXISTS sales_created_at_idx     ON public.sales (created_at DESC);                              -- Reportes, Historial
CREATE INDEX IF NOT EXISTS sales_liquidated_at_idx  ON public.sales (liquidated_at DESC) WHERE liquidated_at IS NOT NULL; -- ventas de apartados por día
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);                       -- feed de Actividad
CREATE INDEX IF NOT EXISTS activity_log_user_idx    ON public.activity_log (user_email, created_at DESC);           -- filtro por persona, límites de PIN
CREATE INDEX IF NOT EXISTS activity_log_action_idx  ON public.activity_log (action, created_at DESC);               -- filtro por tipo, intentos fallidos
CREATE INDEX IF NOT EXISTS products_supplier_code_idx ON public.products (supplier_code) WHERE supplier_code IS NOT NULL; -- Recepción con IA
CREATE INDEX IF NOT EXISTS products_store_idx       ON public.products ("position") WHERE is_published AND NOT is_archived; -- Tienda
CREATE INDEX IF NOT EXISTS recently_edited_at_idx   ON public.recently_edited (edited_at DESC);                     -- orden "editados hace poco"

-- ---------------------------------------------------------------------------
-- Permisos mínimos. Las reglas RLS ya frenaban todo esto, pero lo profesional
-- es no dar el permiso: dos candados en vez de uno.
-- ---------------------------------------------------------------------------
-- Visitantes de la Tienda (anon): solo leer config (RLS limita a las filas públicas)
-- y las columnas públicas de products (ya dadas columna por columna arriba).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT SELECT ON public.config TO anon;
GRANT SELECT (id, name, category, category_label, price, original_price, description, image, images,
              badge, badge_type, featured, out_of_stock, is_apartado, is_published, kit_items, "position", stock)
  ON public.products TO anon;
-- Personal (authenticated): nada de TRUNCATE (se salta RLS), TRIGGER, REFERENCES ni MAINTAIN.
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON ALL TABLES IN SCHEMA public FROM authenticated;
-- Funciones: anon (visitantes de la Tienda) solo puede registrar un login fallido.
-- En el piloto también podía llamar cancel_sale_atomic (la función lo rechazaba por dentro, pero no debía poder).
-- Lo que heredaba EXECUTE de PUBLIC pasa a ser solo del personal; se quedan públicas las
-- funciones de trigger (no se pueden llamar por API) y las de validar fotos (las usa el CHECK).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype <> 'trigger'::regtype
      AND p.proname NOT IN ('te_is_safe_img_url', 'te_are_safe_img_urls', 'te_log_failed_login', 'rls_auto_enable')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.te_log_failed_login(text) TO anon;

-- Relación sin índice (señalada por el asesor de rendimiento de Supabase)
CREATE INDEX IF NOT EXISTS pos_rpc_requests_sale_id_idx ON public.pos_rpc_requests (sale_id) WHERE sale_id IS NOT NULL;
