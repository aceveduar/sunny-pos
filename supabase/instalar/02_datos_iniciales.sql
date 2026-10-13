-- Sunny POS — datos iniciales de un negocio nuevo (después de 01_estructura.sql).
-- Categorías genéricas de boutique y ajustes por defecto. La dueña los cambia
-- después en Configuración → Catálogo. No pisa nada si ya existe.
BEGIN;

INSERT INTO public.config (id, value) VALUES
  ('categories', $json$[
    {"code":"ropa","label":"Ropa","color":"#C9A462"},
    {"code":"blusas","label":"Blusas","color":"#C9A462","parent":"ropa"},
    {"code":"vestidos","label":"Vestidos","color":"#C9A462","parent":"ropa"},
    {"code":"pantalones","label":"Pantalones","color":"#C9A462","parent":"ropa"},
    {"code":"bolsos","label":"Bolsos","color":"#60a5fa"},
    {"code":"carteras","label":"Carteras","color":"#60a5fa","parent":"bolsos"},
    {"code":"mochilas","label":"Mochilas","color":"#60a5fa","parent":"bolsos"},
    {"code":"calzado","label":"Calzado","color":"#a78bfa"},
    {"code":"accesorios","label":"Accesorios","color":"#f472b6"},
    {"code":"joyeria","label":"Joyería","color":"#f472b6","parent":"accesorios"},
    {"code":"cabello","label":"Cabello","color":"#f472b6","parent":"accesorios"},
    {"code":"lentes","label":"Lentes","color":"#f472b6","parent":"accesorios"},
    {"code":"belleza","label":"Belleza","color":"#34d399"},
    {"code":"maquillaje","label":"Maquillaje","color":"#34d399","parent":"belleza"},
    {"code":"cuidado_personal","label":"Cuidado personal","color":"#34d399","parent":"belleza"},
    {"code":"perfumes","label":"Perfumes","color":"#34d399","parent":"belleza"},
    {"code":"regalos","label":"Regalos","color":"#fb923c"}
  ]$json$),
  -- Interruptores de Configuración → Catálogo
  ('wa_float',       'true'),   -- botón flotante de WhatsApp en la Tienda
  ('captura_rapida', 'true'),   -- foto + IA → producto
  ('show_creator',   'false'),  -- "Creado por" en Inventario
  ('show_restock',   'true'),   -- Reabastecer desde Caja
  ('show_recv',      'true'),   -- Recibir mercancía
  ('show_recv_ia',   'false'),  -- Recepción con IA: se prende cuando haya clave de IA
  ('show_libreta',   'false')
ON CONFLICT (id) DO NOTHING;

COMMIT;
