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

-- ---------------------------------------------------------------------------
-- Ubicación de la tienda (aviso "cerró/abrió caja lejos del local" en Actividad).
-- El piloto la tenía fija en el código; ahora sale de config.ubicacion_tienda
-- = {"lat": 19.4326, "lng": -99.1332}. Sin ese dato no se calcula ni se avisa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._te_distance_to_store_m(p_lat double precision, p_lng double precision)
RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH t AS (
    SELECT (value::jsonb ->> 'lat')::double precision AS lat, (value::jsonb ->> 'lng')::double precision AS lng
    FROM public.config WHERE id = 'ubicacion_tienda'
  )
  SELECT CASE WHEN p_lat IS NULL OR p_lng IS NULL OR t.lat IS NULL OR t.lng IS NULL THEN NULL::numeric ELSE
    ROUND((6371000 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(t.lat)) * cos(radians(p_lat)) * cos(radians(p_lng) - radians(t.lng))
      + sin(radians(t.lat)) * sin(radians(p_lat))))))::numeric, 0)
  END
  FROM (SELECT 1) one LEFT JOIN t ON true;
$$;
CREATE OR REPLACE FUNCTION public._te_is_far_from_store(p_lat double precision, p_lng double precision)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(public._te_distance_to_store_m(p_lat, p_lng) > 150, false);
$$;

-- La libreta (apartados de papel) era solo del negocio piloto: Sunny POS no la usa
DROP FUNCTION IF EXISTS public.te_libreta_apartado_create(uuid,text,text,numeric,numeric,jsonb,date,date,text,text,uuid[]);
DROP FUNCTION IF EXISTS public.te_libreta_apartado_edit(uuid,bigint,bigint,text,text,date,text,numeric,uuid[]);
DELETE FROM public.config WHERE id = 'show_libreta';

-- ---------------------------------------------------------------------------
-- Avisos al equipo (traído del negocio piloto, 2026-10-14): la dueña publica,
-- edita y quita los avisos de la campana desde Configuración → Avisos al equipo
-- y ve quién los leyó (leído = lo desplegó). Antes eran un arreglo en shared.js.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_notices (
  id          bigserial PRIMARY KEY,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  body        text NOT NULL DEFAULT '' CHECK (char_length(body) <= 280),
  help_query  text CHECK (help_query IS NULL OR char_length(help_query) <= 60), -- "Ver cómo": búsqueda en Ayuda
  audience    text NOT NULL DEFAULT 'todos' CHECK (audience IN ('todos','caja','inventario')),
  until       date NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_notice_reads (
  notice_id   bigint NOT NULL REFERENCES public.team_notices(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_email)
);

ALTER TABLE public.team_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_notice_reads ENABLE ROW LEVEL SECURITY;

-- Escritura solo por RPC; lectura: avisos para todo el personal, lecturas solo las propias
-- (quién leyó qué lo da te_notice_readers a quien administra).
REVOKE ALL ON public.team_notices, public.team_notice_reads FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.team_notices_id_seq FROM anon, authenticated;
GRANT SELECT ON public.team_notices, public.team_notice_reads TO authenticated;

DROP POLICY IF EXISTS team_notices_read ON public.team_notices;
CREATE POLICY team_notices_read ON public.team_notices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS team_notice_reads_own ON public.team_notice_reads;
CREATE POLICY team_notice_reads_own ON public.team_notice_reads FOR SELECT TO authenticated
  USING (user_email = lower((select auth.jwt()) ->> 'email'));

-- Publicar o editar (p_id NULL = nuevo)
CREATE OR REPLACE FUNCTION public.te_save_notice(p_id bigint, p_title text, p_body text, p_help_query text,
                                                 p_audience text, p_until date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
DECLARE v_id bigint; v_email text := lower(auth.jwt() ->> 'email');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autenticado'; END IF;
  IF NOT public.te_has_permission('canManageSettings') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin permiso para publicar avisos';
  END IF;
  IF p_until IS NULL OR p_until < (now() AT TIME ZONE 'America/Mexico_City')::date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La fecha "mostrar hasta" ya pasó';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.team_notices (title, body, help_query, audience, until, created_by)
    VALUES (btrim(p_title), coalesce(btrim(p_body), ''), nullif(btrim(p_help_query), ''), coalesce(p_audience, 'todos'), p_until, v_email)
    RETURNING id INTO v_id;
    PERFORM public.te_log_activity('aviso_publicado', 'Publicó el aviso "' || btrim(p_title) || '"', jsonb_build_object('notice_id', v_id));
  ELSE
    UPDATE public.team_notices
       SET title = btrim(p_title), body = coalesce(btrim(p_body), ''), help_query = nullif(btrim(p_help_query), ''),
           audience = coalesce(p_audience, 'todos'), until = p_until, updated_at = now()
     WHERE id = p_id AND active
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Ese aviso ya no existe'; END IF;
    PERFORM public.te_log_activity('aviso_editado', 'Editó el aviso "' || btrim(p_title) || '"', jsonb_build_object('notice_id', v_id));
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Quitar (queda en la tabla para el historial; deja de mostrarse)
CREATE OR REPLACE FUNCTION public.te_remove_notice(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
DECLARE v_title text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autenticado'; END IF;
  IF NOT public.te_has_permission('canManageSettings') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin permiso para quitar avisos';
  END IF;
  UPDATE public.team_notices SET active = false, updated_at = now() WHERE id = p_id AND active RETURNING title INTO v_title;
  IF v_title IS NOT NULL THEN
    PERFORM public.te_log_activity('aviso_quitado', 'Quitó el aviso "' || v_title || '"', jsonb_build_object('notice_id', p_id));
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Marcar leído (al desplegar el aviso). Idempotente.
CREATE OR REPLACE FUNCTION public.te_mark_notice_read(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autenticado'; END IF;
  INSERT INTO public.team_notice_reads (notice_id, user_email)
  SELECT p_id, lower(auth.jwt() ->> 'email') WHERE EXISTS (SELECT 1 FROM public.team_notices WHERE id = p_id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Quién leyó cada aviso activo (para Configuración → Avisos)
CREATE OR REPLACE FUNCTION public.te_notice_readers()
RETURNS TABLE (notice_id bigint, user_email text, read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.te_has_permission('canManageSettings') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin permiso';
  END IF;
  RETURN QUERY SELECT r.notice_id, r.user_email, r.read_at
    FROM public.team_notice_reads r JOIN public.team_notices n ON n.id = r.notice_id
   WHERE n.active ORDER BY r.read_at;
END $$;

REVOKE ALL ON FUNCTION public.te_save_notice(bigint,text,text,text,text,date), public.te_remove_notice(bigint),
                       public.te_mark_notice_read(bigint), public.te_notice_readers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.te_save_notice(bigint,text,text,text,text,date), public.te_remove_notice(bigint),
                          public.te_mark_notice_read(bigint), public.te_notice_readers() TO authenticated;

-- Avisos: leído y descartado van por persona, no por dispositivo (tablet compartida)
ALTER TABLE public.team_notice_reads ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

DROP FUNCTION IF EXISTS public.te_mark_notice_read(bigint);
CREATE OR REPLACE FUNCTION public.te_mark_notice_read(p_id bigint, p_dismiss boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autenticado'; END IF;
  INSERT INTO public.team_notice_reads (notice_id, user_email, dismissed_at)
  SELECT p_id, lower(auth.jwt() ->> 'email'), CASE WHEN p_dismiss THEN now() END
   WHERE EXISTS (SELECT 1 FROM public.team_notices WHERE id = p_id)
  ON CONFLICT (notice_id, user_email) DO UPDATE
    SET dismissed_at = CASE WHEN p_dismiss THEN coalesce(team_notice_reads.dismissed_at, now())
                            ELSE team_notice_reads.dismissed_at END;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.te_mark_notice_read(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.te_mark_notice_read(bigint, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Variantes (tallas, colores, tamaños) — 2026-10-15
-- Cada variante es un producto normal (su stock, precio y código de barras);
-- las de una misma prenda comparten variant_group. Sin producto "padre": ventas,
-- apartados, kits, escáner y reportes siguen igual. El nombre completo incluye la
-- variante ("Blusa lino · M · Negro"); variant_base guarda "Blusa lino".
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_group uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant jsonb;        -- [["Talla","M"],["Color","Negro"]] (lista: jsonb no respeta el orden de un objeto)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_base text;    -- nombre sin la variante
CREATE INDEX IF NOT EXISTS products_variant_group_idx ON public.products (variant_group) WHERE variant_group IS NOT NULL;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_variant_check;
ALTER TABLE public.products ADD CONSTRAINT products_variant_check CHECK (
  variant_group IS NULL OR (jsonb_typeof(variant) = 'array' AND variant_base IS NOT NULL AND kit_items IS NULL));
-- La Tienda (anon) necesita agruparlas
GRANT SELECT (variant_group, variant, variant_base) ON public.products TO anon;

-- ---------------------------------------------------------------------------
-- Forma de pago Tarjeta (terminal: Clip, Mercado Pago, banco) — 2026-10-16
-- Igual que transferencia: no entra al cajón (el corte solo espera efectivo).
-- Las RPC de cobro validaban ('efectivo','transferencia'); se reescriben desde
-- su propia definición para no copiar aquí 300 renglones (idempotente).
-- ---------------------------------------------------------------------------
ALTER TABLE public.sale_payments DROP CONSTRAINT IF EXISTS sale_payments_method_check;
ALTER TABLE public.sale_payments ADD CONSTRAINT sale_payments_method_check
  CHECK (method = ANY (ARRAY['efectivo', 'transferencia', 'tarjeta', 'unknown']));
DO $$
DECLARE f record; d text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('record_sale_atomic_v2', 'record_apartado_payment_atomic', 'te_refund_sale_balance') LOOP
    d := pg_get_functiondef(f.oid);
    IF position('''tarjeta''' IN d) = 0 THEN
      d := replace(d, 'NOT IN (''efectivo'', ''transferencia'')', 'NOT IN (''efectivo'', ''transferencia'', ''tarjeta'')');
      d := replace(d, 'WHEN ''transferencia'' THEN 2 ELSE 3 END', 'WHEN ''transferencia'' THEN 2 WHEN ''tarjeta'' THEN 3 ELSE 4 END');
      EXECUTE d;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- La venta guarda la categoría (y la talla/color) de cada renglón — 2026-10-16
-- Antes, si el producto se borraba, Reportes mostraba su venta como "Otro".
-- No se guarda el costo: las cajeras leen las ventas y el costo es interno.
-- ---------------------------------------------------------------------------
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'te_snapshot_sale_items';
  IF d IS NOT NULL AND position('''category'', v_product.category' IN d) = 0 THEN
    d := replace(d, '''subtotal'', round(v_price * v_qty, 2)
    );', '''subtotal'', round(v_price * v_qty, 2),
      ''category'', v_product.category
    );
    IF v_product.variant_group IS NOT NULL THEN
      v_normalized := v_normalized || jsonb_build_object(''variant'', v_product.variant, ''variant_base'', v_product.variant_base);
    END IF;');
    IF position('''category'', v_product.category' IN d) = 0 THEN
      RAISE EXCEPTION 'te_snapshot_sale_items cambió: no se pudo agregar la categoría';
    END IF;
    EXECUTE d;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- VERSIÓN DE LA BASE — debe ir SIEMPRE al final de este archivo.
-- Cada cambio de esquema nuevo sube esta fecha y la constante _BASE_REQUERIDA
-- de shared.js. Si la app pide una versión más nueva que la de la base de un
-- negocio (se publicó código sin aplicar mejoras.sql), avisa a la dueña.
-- ---------------------------------------------------------------------------
INSERT INTO public.config (id, value) VALUES ('version_base', '2026-10-16')
  ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
