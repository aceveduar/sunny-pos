# CLAUDE.md — Sunny POS

> **Sunny POS**: caja, inventario, reportes y tienda en línea con pedidos por WhatsApp para tiendas chicas (boutiques, accesorios, belleza). Nació el 2026-10-13 como copia genérica de Tres Encantos (el piloto, otro repo) para venderse. Avance y pendientes en [PLAN.md](PLAN.md): leerlo al empezar cada sesión y marcar lo terminado.
> Cada negocio tiene **su propio proyecto de Supabase**, su Apps Script de Drive y su `negocio.js` (nombre, color, WhatsApp, dueña, contenido de la Tienda); el resto del código es igual para todos.
> **Nunca conectarse a la base de Tres Encantos desde aquí** (ref `qxvrggmpaqhslgdmbhqw`; el CLI de la PC está logueado en esa cuenta y su respaldo nocturno depende de esa sesión: no hacer `supabase login` con otra cuenta). Para Sunny se usa el token en `~/sunnypos-token.txt` (ver Supabase → Acceso).
> Eduardo es olvidadizo a propósito de los pasos: cuando algo dependa de él (crear proyectos, pegar claves, Apps Script), decírselo poco a poco, un paso a la vez.
> `Documents\erpsunname` ("Sunname ERP") es otro sistema aparte: no mezclarlo.

---

## Rol de Claude

Actuar como **experto en UX/UI para e-commerce, redactor y estratega de conversión**:
- **Mobile first** — toda decisión se valida primero en 360–430px.
- **Estándar e-commerce** (ZARA, Amazon, Shopify, H&M): CTA siempre visible sin scroll, imágenes sin recorte, jerarquía clara, navegación predecible. Señalar y corregir lo que no cumpla aunque no se pida.
- Proponer mejoras de diseño/copy/usabilidad proactivamente; dar la mejor recomendación aunque difiera de lo que pide el usuario.
- Priorizar a la usuaria final (la dueña de la tienda, sus cajeras y sus clientas) sobre preferencias técnicas.

**Preferencias confirmadas de Eduardo:**
- **Minimalismo literal**: sin tintes/acentos de color para "jerarquía", sin emoji decorativos en UI (íconos SVG de línea, `stroke="currentColor"`, trazo 1.75). Emoji sí en mensajes de WhatsApp.
- **No sobrecargar la interfaz**: extender pantallas/menús existentes antes de crear nuevos.
- **Hay dueñas que ven poco** (la del piloto): la letra nunca se achica; el espaciado sí se puede apretar.
- **Tamaño táctil mínimo 44px** (con *hit slop* `::after{inset:-7px}` si el botón visual debe ser chico).

| Módulo | Referencias |
|---|---|
| Caja | Shopify POS, Square POS, Clip |
| Inventario | Shopify Admin, WooCommerce, Airtable |
| Reportes | Shopify Analytics, Square Dashboard |
| Tienda | ZARA, H&M, Amazon |
| Navegación | Shopify Admin mobile |

Principios: lo visible en una tarjeta no se repite en su modal · thumbnails inline (24–32px) en listas de Caja · modales/cards de Reportes solo texto · acciones destructivas con `stopPropagation` y confirmación · búsqueda mobile con ✕ para limpiar.

---

## Descripción y stack

Panel de administración + caja + reportes + tienda en línea. En la Tienda los pedidos se arman en carrito y se cierran por WhatsApp — sin pago en línea.

- **Frontend:** HTML + CSS + Vanilla JS, sin framework ni bundler.
- **Configuración por negocio — `negocio.js`** (se carga en `<head>` de todas las páginas): `nombre`, `supabaseUrl`/`supabaseAnonKey`, `whatsapp` (10 dígitos), `duena {nombre, correo}` ("Ya lo cobró <dueña>"), `logo` (vacío = nombre en letra elegante, `[data-negocio-logo]`), `color` de marca (de él se calculan `--brand-dark`, `--brand-light`, `--brand-claro`, `--on-brand`), `analyticsId` y `tienda {titulo, descripcion, zona, acerca, nosotros, direccion, entregas, redes, catalogo}` — lo vacío se oculta solo. `?color=RRGGBB` en la dirección prueba otro color sin tocar el archivo (`?color=0` lo quita).
- **Backend:** Supabase (PostgREST + RPC SECURITY DEFINER + RLS), un proyecto por negocio. Pruebas: `Sunny POS Pruebas` (ref `aduahsqbmborplojhubw`, org Sunname Technologies).
- **Auth:** Supabase Auth JWT en `localStorage.te_admin_session` (`{access_token, refresh_token, expires_at}`; válida si `expires_at > now+60s`). Registro público apagado (las cuentas las crea la dueña); contraseñas de 10+ con letras y números.
- **Hosting:** archivos estáticos, rutas siempre relativas. PWA (`manifest.json` + `sw.js`). Local: `python -m http.server 8080` y abrir `localhost:8080` (no `127.0.0.1:5501`, que Chrome tiene asociado a Tres Encantos). La vista previa al compartir (`og:*` de `index.html`) se escribe a mano por negocio: WhatsApp no ejecuta JS.
- **Fuentes:** Inter (UI) + Playfair Display (solo el número protagonista de una tarjeta y títulos) + Dancing Script. Números siempre alineados (`font-feature-settings:"lnum"` en `body`, shared.css y style.css): los de estilo antiguo de Playfair hacían que $0 se leyera "$o".
- **IA:** Groq, modelo `qwen/qwen3.8-27b` (constante `GROQ_VISION_MODEL`, `admin-images.js`). Toda llamada pasa por la Edge Function `groq-proxy` (valida permisos de Inventario con el JWT y pone la clave en el servidor); `groq_key` no es legible desde el navegador (política de `config`), el cliente solo consulta `te_ai_configured()`. Desplegar con `supabase functions deploy groq-proxy --use-api`. Imágenes en Google Drive vía Apps Script, siempre a través de la Edge Function `drive-proxy` (upload/delete con permisos de Inventario, list con `canManageSettings`/`canImportExport`); `drive_secret` no es legible por SELECT, Configuración lo pide con `te_get_drive_secret()` (`canManageSettings`). Desplegar con `supabase functions deploy drive-proxy --use-api`.

---

## Módulos y archivos

Usar siempre estos nombres en UI y conversación (nunca "Admin", "POS", "Stats"):

| Archivos | Nombre | Uso |
|---|---|---|
| `index.html` `app.js` `style.css` | **Tienda** | Sitio público (anon key) |
| `admin.html` `admin.css` `admin*.js` | **Inventario** | CRUD productos |
| `pos.html` `pos.css` `pos-*.js` | **Caja** | Punto de venta |
| `stats.html` `stats.css` `stats.js` | **Reportes** | Estadísticas |
| `activity.html` `activity.css` `activity.js` | **Actividad** | Log de auditoría |
| `settings.html` `settings.css` `settings.js` `settings-avisos.js` `settings-nav.js` | **Configuración** | Ajustes globales |
| `shared.js` `shared.css` | — | Común a los 5 módulos admin (menú avatar, PIN, campana, offline, permisos de nav, tema) |

Inventario: `admin.js` (core, auth, carga) · `admin-render.js` (cards/tabla/inline edits) · `admin-form.js` (formulario, kits, fotos) · `admin-images.js` (Drive, Groq) · `admin-bulk.js` · `admin-scanner.js` (escáner, duplicados, archivar) · `admin-utils.js` · `admin-recv.js` (Recibir mercancía) · `admin-recv-ia.js` (Recepción con IA) · `admin-capture.js` (Captura rápida) · `admin-qv.js` (Quick View) · `admin-kit-builder.js` · `admin-variantes.js` (tallas y colores: alta, cuadrícula de la ficha, fotos por color, códigos, juntar/quitar) · `admin-etiquetas.js` (imprimir etiquetas).
Caja: `pos-core.js` (config, auth, API, catálogo, turnos) · `pos-cart.js` (carrito, corte, gastos) · `pos-ui.js` (historial, detalle) · `pos-apartados.js` · `pos-checkout.js` (cobrar, escáner, init).
Otros: `tema.css` (sistema de diseño) · `negocio.js` · `supabase/instalar/` (instalación de una base nueva) · `supabase/migrations/` (historial del piloto, solo referencia) · `supabase/functions/create-user/` (Edge Function para crear usuarios) · `assets/MANUAL.md` (manual de usuario) · `assets/apps_script_actualizado.gs` (código del Apps Script de Drive) · `img/`.

**Navegación:** topbar con íconos de Caja, Inventario, Reportes, Tienda. Actividad, Configuración, "Mi PIN", "Modo oscuro", "Avisarme al vender" (solo superadmin) y Cerrar sesión viven en el menú del avatar. Sin botón "atrás". Textos de la barra a 11px (`.69rem`, antes 8px) e inactivos al 75%; en celular la nav se centra en el espacio libre antes de campana/avatar (centrada en absoluto chocaba a 360px). `_applyNavPermissions()` (`shared.js`) oculta íconos según permisos.

---

## Supabase

### Acceso e instalación
- **Correr SQL:** `python scripts/instalar/sql.py archivo.sql` o `-e "select …"` (`--raw` = JSON). Usa la Management API con el token de `~/sunnypos-token.txt` (fuera del repo, nunca pegarlo en el chat) y toma el proyecto de `negocio.js` (o `SUPABASE_REF`). `supabase db query` no sirve aquí (solo `--linked`, y el CLI es de Tres Encantos).
- **Funciones Edge:** `SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy <nombre> --project-ref <ref> --use-api` (solo en ese comando, nunca global). Usan la service role que inyecta Supabase; no hay secretos que pegar.
- **Negocio nuevo:** `supabase/instalar/01_estructura.sql` (todo, generado) → `02_datos_iniciales.sql` (categorías y ajustes) → crear la cuenta de la dueña en Authentication → `03_primera_duena.sql`. Al crear el proyecto: Data API sí, "exponer tablas nuevas automáticamente" **no**, RLS automática sí.
- **Cambiar la base:** el instalador se genera con `scripts/instalar/generar_estructura.py` (catálogo de la base + `mejoras.sql` al final). Todo cambio de esquema va en `mejoras.sql` (idempotente) y se aplica también a las bases existentes; no editar `01_estructura.sql` a mano.
- **Demo:** `scripts/demo/productos_demo.py [n]` (productos con foto, `created_by='demo'`) y `scripts/demo/ventas_demo.py [días]` (historial para Reportes, cajeras `@demo.sunnypos`); los dos aceptan `--borrar`.

### Tablas
- **`products`** — `id` (lo asigna la BD con `products_id_seq`; **nunca calcularlo en el cliente** — crear con `Prefer: return=representation` y leer el id de la respuesta. Un trigger adelanta la secuencia si se inserta con id explícito, como Importar JSON o Deshacer eliminar), `name`, `category`/`category_label`, `price`, `original_price`, `cost` (interno), `description`, `image` (principal), `images` jsonb (adicionales, máx 5), `badge`/`badge_type` (`best|new|promo|natura`; CHECK en base), `featured`, `out_of_stock`, `is_apartado`, `stock`, `barcode`, `supplier_code` (código del proveedor, enseña a Recepción con IA), `position`, `is_published`, `is_archived`, `kit_items` jsonb `[{id,name,qty}]`, `expiry_date`, `created_by`.
- **`sales`** — `id`, `items` jsonb (snapshot; `kit_items` histórico por item), `total`, `discount`, `payment_method`, `note`, `customer` (texto `"Nombre · 📱 Tel"` — ese separador es formato de dato, no tocar), `customer_id` → `customers`, `due_date`, `seller_email`, **`origin_type`** (`venta|apartado`, inmutable), **`status`** (`activo|liquidado|cancelado`), `paid_amount`, `created_at` (inmutable), `liquidated_at`, `last_payment_at`, `cancelled_at`, `updated_at`, `version` (optimista). `type` solo por compatibilidad — la lógica usa `origin_type`+`status`.
- **`sale_payments`** — libro monetario **append-only**: `sale_id`, `request_id`, `kind` (`payment|refund|adjustment`), `amount` (con signo), `method`, `paid_at`, `collected_by_email`, `source` (`rpc_direct_sale|rpc_apartado_initial|rpc_apartado_payment|rpc_apartado_liquidation|rpc_apartado_reactivation|…`), `meta`. **Todo el dinero se calcula desde aquí por `paid_at`.**
- **`customers`** — `name`, `phone` (único parcial, 10 dígitos), `notes`. Alta solo vía `te_find_or_create_customer`.
- **`cash_shifts`** — turnos de caja (`opened_at`, `closed_at`, `fondo_inicial`, `conteo_final`, `efectivo_neto`, `gastos_total`, `esperado`, `diferencia`, `status abierto|cerrado|cerrado_auto`). **`cash_shift_expenses`** — gastos del turno.
- **`config`** — `categories`, `revista_url`, `revista_cover`, `wa_float`, `groq_key`, `drive_ep`, `drive_secret`, `user_names`, `user_permissions`, toggles (`captura_rapida`, `show_creator`, `show_recv`, `show_recv_ia`, `show_restock`), etc.
- **`team_notices`** (avisos de la campana: `title` ≤60, `body` ≤280, `help_query`, `audience` `todos|caja|inventario`, `until`, `active`) + **`team_notice_reads`** (`notice_id`, `user_email`, `dismissed_at`). Escritura solo por RPC (`te_save_notice`, `te_remove_notice` con `canManageSettings`; `te_mark_notice_read(p_id, p_dismiss)` cualquiera); cada quien lee solo sus lecturas, `te_notice_readers()` da todas a quien administra. Traído de Tres Encantos 2026-10-14.
- **`activity_log`** (`action`, `user_email`, `summary`, `meta`), **`pos_rpc_requests`** (idempotencia, privada), **`permission_overrides`** + **`user_pins`** (PIN de gerente), **`recently_edited`**. (`usage_log` se eliminó: nadie la usaba.)

### Reglas de datos
- **Disponibilidad la calcula la base** (trigger `te_products_stock_sync`, 2026-10-10) desde el stock y los apartados activos, en todo INSERT/UPDATE: stock>0 → disponible; stock 0 + apartado activo → `is_apartado` (Tienda "📌 Apartado"); stock 0 sin apartar → agotado; archivado → agotado. Marcar a mano "Agotado" con piezas → stock 0; "Disponible" con 0 → stock 1. No escribir `out_of_stock`/`is_apartado` esperando que se queden distintos: el trigger los recalcula. (Antes se contradecían: "apartado" con piezas libres, disponible con 0 piezas.)
- **Kits:** `stock=0` y `out_of_stock=false` siempre en BD; disponibilidad = `min(floor(comp.stock/comp.qty))`. Vender/cancelar descuenta/restaura componentes.
- **Tienda muestra** `is_published=true AND category≠por_revisar AND (out_of_stock=false OR is_apartado=true)`.
- **Archivar** (`is_archived=true` + oculto + agotado) es el borrado reversible preferido; nunca borrado real masivo (un producto puede ser componente vivo de un kit).
- **No borrar un producto que esté en un apartado activo** (ni como componente de kit): lo exige `te_delete_products` en servidor (y `_productsInActiveApartados()` lo avisa antes en el cliente) — las RPC de editar/cancelar exigen que todos los productos existan.
- **Categorías** en `config.categories` (`{code,label,color,parent?}`, 7 raíces). Riesgo: renombrar/eliminar un código deja productos huérfanos invisibles en filtros. Si un producto "desaparece" del filtro pero aparece en búsqueda, comparar su `category` contra los códigos vigentes.

### Roles y permisos
3 roles. **El servidor toma el rol de `config.user_permissions[email].role`** (lo que se edita en Configuración → Usuarios y Permisos); si el mapa existe y la persona no está, es `operador`. `user_metadata.role` solo lo usa el cliente como respaldo visual mientras carga `get_my_permissions()` — y cada usuario puede editar su propio `user_metadata`, así que **nunca** usarlo para autorizar en servidor. `duena` = alias de `superadmin`.
- **superadmin** — la dueña (y Sunname para soporte). Todo.
- **encargado** — empleada de confianza: operación total en Caja/Inventario, sin Reportes/Actividad/Configuración.
- **operador** — punto de partida para gente nueva; casi nada por default.

Permisos (`UP_PERMS`/`UP_ROLE_DEFAULTS`, `shared.js`): `canAddProduct canEditProduct canUseReceptionIA canReceiveStock canDeleteProduct canPublishProduct canBulkDelete canCancelSale canEditApartado canGiveCredit canOverridePrice canApplyDiscount canCloseShiftUnsupervised canViewReports canViewActivity canManageSettings canManageCatalogSettings canImportExport`.
- Overrides por persona en `config.user_permissions`, editables en Configuración → Usuarios y Permisos (lista o matriz). Solo se escriben vía `te_save_user_permissions` (exige `canManageSettings`, registra el diff en Actividad). El resto de `config` vía `te_save_config_value` (valida el permiso según el `id`: Catálogo → `canManageCatalogSettings`, `user_names` → `canImportExport`, `flagged_products`/`dismissed_dups` → `canEditProduct`, lo demás → `canManageSettings`). **Nunca escribir `config` con POST directo**: solo funciona para superadmin y falla en silencio para los demás. En Inventario usar `_saveConfigValue()` (`admin.js`); en Configuración, su homónima en `settings.js`.
- **Fuente autoritativa:** RPC `get_my_permissions()`. `sessionStorage.te_user_can` es solo caché offline; los módulos restringidos siempre consultan al servidor.
- **Todo permiso nuevo debe agregarse en los dos lados**: `shared.js` y `_te_permission_for_email()`/`get_my_permissions()` en Postgres (ya pasó que solo existía en la UI y no tenía efecto real).
- **PIN de gerente:** quien no tiene un permiso puede hacer la acción si alguien que sí lo tiene teclea su propio PIN en ese dispositivo (`requestOverride()` en `shared.js` → ticket de un solo uso, 5 min). Botones siempre visibles; es la acción la que pide autorización. 5 intentos fallidos/10 min bloquean. Cubre precio, descuento, cancelar, editar/reembolsar apartado, cerrar turno con diferencia grande. No cubre Inventario.
- Sin `canPublishProduct`: crear producto → se guarda oculto, y pasar de oculto a publicado se rechaza (trigger `te_products_publish_guard` en servidor; ocultar sí se permite).
- Cambiar rol: Configuración → Usuarios y Permisos. Crear usuarios: desde Configuración (Edge Function `create-user`).

### Seguridad
- **Nunca** `service_role key` en el cliente. Cliente usa `SUPABASE_ANON_KEY` como `apikey` + JWT del usuario como Bearer.
- **anon** (Tienda) solo lee: `products` publicados y solo las columnas que usa `app.js` (sin `cost`/`barcode`/`supplier_code`) + `config` `categories,wa_float,revista_url,revista_cover,sales_counts`. Solo puede ejecutar `te_log_failed_login`. Permisos mínimos por GRANT además de RLS (`mejoras.sql`): anon sin INSERT/UPDATE/DELETE en ninguna tabla, nadie con TRUNCATE. Las funciones que heredaban EXECUTE de PUBLIC pasan a `authenticated` (salvo las de trigger y las del CHECK de imágenes).
- **`sales` no acepta INSERT/UPDATE/DELETE directo** de nadie: solo las RPC v2. Lectura abierta a autenticados.
- **`products` no acepta DELETE directo**: solo `te_delete_products` (permiso + registro + apartados activos) y `te_undo_duplicate_product`.
- **`products`**: `id`, `created_at` y `created_by` son inmutables por API (trigger `te_products_immutable_cols`; antes permitía borrar cualquier producto vía `te_undo_duplicate_product`). `image`/`images` tienen CHECK `products_image_safe` (solo `https://`, `data:image/`, `img/`, sin comillas/`<>`/espacios) porque se pintan en `src="…"` sin escapar.
- **`customers`**: UPDATE directo solo con `canViewReports` (Reportes → Clientes frecuentes); Caja edita por RPC.
- **Límites por conteo en `activity_log` (PIN, login fallido): nunca registrar el intento y luego `RAISE`** — la excepción revierte el registro y el contador queda en 0 para siempre (pasó con el PIN hasta 2026-10-06). Registrar y regresar `{ok:false, message}`.
- **`activity_log`**: un trigger fija `user_email` y `created_at` desde el JWT en inserts directos (no se puede escribir a nombre de otra persona ni con fecha falsa).
- Auxiliares internas sin EXECUTE para `authenticated`: `te_refund_sale_balance`, `te_rpc_store`, `te_rpc_replay`, `te_snapshot_sale_items`, `te_consume_override`, `te_log_activity` (antes una cajera podía registrar devoluciones falsas llamando la primera directo).
- **Eliminar producto** (`te_delete_products`): Actividad guarda nombre en el resumen y en `meta.products` una foto de cada producto borrado (nombre, precio, costo, stock, categoría, código, imagen). Antes solo el id ("Eliminó 1 producto").
- **`product_changes`** (caja negra): trigger que registra todo cambio manual de precio/costo/stock/agotado/publicado/archivado/nombre (quién, cuándo, antes→después). Excluye las RPC de venta (`rpc_v2`). Solo lectura superadmin. Se decidió esto en vez de bloquear precio/stock por permiso fino (los operadores tienen `canEditProduct` por defecto y precio/costo cambian desde 3 permisos distintos).
- Políticas RLS escritas `TO anon`/`TO authenticated` (no `auth.role() = …` en `TO public`) y `get_user_role()` dentro de `(select …)`.
- Toda función nueva nace sin EXECUTE para anon/PUBLIC (default privileges); dar `GRANT EXECUTE … TO authenticated` explícito. Helpers internos (llamados solo por otras SECURITY DEFINER) no se dan a `authenticated`.
- RLS combina políticas permisivas con **OR**: una política vieja `USING (true)` anula todas las demás. Al auditar, revisar `pg_policies` completo, no solo las políticas nuevas.
- **Reglas en base (no solo en pantalla):** precio, costo y stock no negativos; código de barras único (vacío = null, trigger `te_products_normalize`); lo creado sin decir lo contrario nace oculto.
- Para auditar: `GET https://api.supabase.com/v1/projects/<ref>/advisors/{security,performance}` con el token, y consultas con la anon key de `app.js`.

### RPC de Caja v2 (únicas que mutan dinero/stock de ventas)
`record_sale_atomic_v2`, `record_apartado_payment_atomic`, `edit_apartado_atomic`, `cancel_sale_atomic`, `refund_apartado_atomic`, `reactivate_apartado_atomic`, `te_open_cash_shift`, `te_close_cash_shift`, `te_add_shift_expense`, `te_cancel_shift_expense`. Todas idempotentes por `p_request_id` (el cliente reintenta con el mismo UUID vía `posRpc()`), con lock de inventario, versión optimista, snapshots de kits y registro en Actividad dentro de la misma transacción. Escriben con `SET LOCAL sunnypos.rpc_v2='on'`.
- **Nunca** modificar `created_at`; nunca borrar ni editar filas de `sale_payments` (las correcciones son filas nuevas).
- Cambiar la firma de una RPC: `DROP FUNCTION` de la firma vieja antes de crear la nueva — si no, quedan overloads y PostgREST/SQL dan "is not unique". Hoy no hay ninguna función duplicada (limpiado 2026-09-30).

### Respaldos
Supabase no tiene respaldos en el plan gratis. `python scripts/respaldo.py` guarda en `Documentos\SunnyPOS-Respaldos\<Negocio>_<fecha>.zip` todas las tablas (JSON), `estructura.sql` instalable (mismo generador del instalador), `auth.users` sin contraseñas y `LEEME.txt` con cómo restaurar; conserva 30, bitácora en `respaldo.log`, y escribe `config.ultimo_respaldo` (`{at, ok, mb, tablas, errores}`) que Configuración → Datos muestra a la superadmin (en rojo si falló o tiene >50 h). Falta la tarea programada diaria (Eduardo).

### Pruebas y errores
- **Pruebas automáticas:** `powershell -ExecutionPolicy Bypass -File scripts\pruebas.ps1` corre `scripts/pruebas/caja.sql` (venta, apartado + abono, cancelación, gastos/ingresos/retiros, cierre de turno, fiado/saldo a favor y candados de seguridad) y `scripts/pruebas/kits_y_apartados.sql` (kits, editar/abonar/liquidar, descuento, doble toque, vender de más, precio sin permiso) contra la base del negocio, dentro de `BEGIN … ROLLBACK`. La dueña y la cajera de prueba se crean dentro de la misma transacción (no dependen de cuentas reales). Correrlo antes de publicar cualquier cambio que toque dinero, stock, turnos o permisos; toda regla de negocio nueva lleva su verificación ahí.
- **Pruebas visuales:** Playwright (Python) contra `localhost:8080`; para entrar, la cuenta `auditor@gmail.com` (superadmin en Pruebas; Eduardo da la contraseña en la sesión, nunca guardarla en archivos).
- **Errores de la app:** `shared.js` manda los errores de JS no atrapados a `te_log_client_error` (tabla `client_errors`, deduplica 24 h, máx. 30/h por persona; ignora errores de red y de scripts ajenos). Se ven en Configuración → Datos → "Errores de la app" (solo superadmin). Revisarlo cuando alguien diga "no sirve".

### Migraciones
- `supabase/migrations/` es el historial del piloto (solo referencia). En Sunny POS los cambios de esquema van en `scripts/instalar/mejoras.sql` (ver Acceso e instalación); para saber si algo se aplicó, **consultar el estado real** (`pg_proc`, `pg_policies`, `information_schema`).
- Probar cambios a RPC dentro de `BEGIN … ROLLBACK` simulando el JWT (`set_config('request.jwt.claims', …)` + `set_config('role','authenticated')`), llamando con argumentos nombrados.

---

## Inventario

- `products[]` global en cliente; Supabase primero, el array local solo cambia si el request fue exitoso. Catálogo cacheado en `localStorage.te_products_cache` para offline.
- Vistas Lista/Grid (mobile: lista = cards anchas, grid = 2 columnas compactas sin etiqueta de categoría) y tabla en desktop; scroll infinito de 50 (`ADMIN_PAGE_SIZE`). Bulk actions operan sobre todo `getFilteredProducts()`, no solo lo renderizado.
- **Búsqueda:** nombre, categoría, código de barras, precio y código de proveedor en un solo campo. Si no hay coincidencia exacta y hay 2+ palabras, cae a similitud por palabras (`_wordSim`, umbral 0.28) y lo avisa en el contador.
- **Barra de la lista (rediseño 2026-10-07, patrón Shopify Admin):** una sola tarjeta con pestañas de **vistas** (Todos · Kits · Apartados · Archivados; "Todos" = mismo número que el contador, kits incluidos) + menú **"Pendientes ▾"** con los filtros de corrección (Sin stock, Por caducar ≤60 días `_EXPIRY_SOON_DAYS`, Marcados para revisar, Sin publicar, Sin precio, Sin categoría, Sin código, Sin cód. proveedor, Foto fuera de Drive); el pendiente activo se ve en el botón. Buscador, y filtros con nombre (Categoría, Orden con ícono, Creado por). En celular las pestañas van solas a todo el ancho, Pendientes baja a la fila de filtros, Ordenar es botón de ícono y Lista/Cuadrícula se elige en "Ordenar y ver" (botón ⇅), con **Lista por defecto** (decisión de Eduardo: barra más limpia; en celular se reinició una vez a Lista). "Seleccionar los N" vive en la barra de selección. No volver a poner los pendientes como chips sueltos. Los kits aparecen en cualquier vista/búsqueda; sus filtros de stock usan `_kitInfo(p).stock`.
- **Inline edits:** stock y precio con popover (`.field-pop`, se reposiciona con scroll, no se cancela), categoría (select), visibilidad Web/Oculto (solo con `canPublishProduct`; si no, badge de solo lectura), estrella destacado.
- **Formulario:** a la vista solo Fotos · Nombre · Categoría · Precio · Costo (margen debajo) · Stock · Código · Publicar; lo demás (descripción, oferta, caducidad, cód. proveedor, kit, insignia, destacado) en "Más detalles" plegado, que se abre solo si el producto ya tiene alguno de esos datos o la IA llena la descripción (`_syncFormMore`). Fotos unificadas (`_allImagesEdit`, `[0]`=principal, máx 6; galería múltiple, cámara, URL, drag&drop, Ctrl+V). Las fotos se suben a Drive al elegirlas; `_sessionUploadedUrls` borra de Drive las de una sesión cancelada; al guardar se borran las URLs que salieron del set. "✨ Completar con IA" (Groq). "+ Otro" guarda y deja el formulario listo para el siguiente, recordando la última categoría (`_lastNewProductCategory`, compartida con Kit Builder). Protección de cambios sin guardar (`_formIsDirty`). Código de barras duplicado bloquea; código de proveedor duplicado solo avisa.
- **Agregar:** un solo punto de entrada (FAB en celular, "+ Agregar ▾" en escritorio) con Producto · Captura · Kit · Recibir · Recepción con IA.
- **Tarjetas:** piezas con unidad ("4 pzas", "1 pza"), en neutro (rojo solo Agotado); en la lista de celular la estrella de destacado va en la esquina de la tarjeta, no encima de la foto. Hojas inferiores siempre con asa + título + ✕; categoría con su rama solo si el nombre se repite (`_catDisplayLabel`: "Natura · Perfumería").
- **Quick View:** acciones = Editar (ancho) · Compartir · Ocultar/Publicar · "Más" (Duplicar, Al inicio, A un kit, Revisar, Archivar, Eliminar al final); "Creado por <nombre>"; swipe ←/→ (navegar), ↓ (cerrar), ↑ (editar), doble tap = zoom; muestra ID, código de barras, código de proveedor, creador (si `show_creator` y superadmin) y "Ver historial" del producto. Layout 2 columnas en desktop.
- **Kit Builder** (FAB 🎁): mínimo 2 componentes; sugiere categoría por nombre.
- **Recibir mercancía** (`admin-recv.js`): modo "Con factura" (default; edita costo/precio/cód. proveedor por renglón) o "Rápido" (solo suma stock). "No encontrado" ofrece buscar por nombre antes de crear; crear un producto regresa a la sesión (`_returnToRecv`). Deshacer restaura stock por diferencia y archiva productos creados en la sesión.
- **Recepción con IA** (`admin-recv-ia.js`): PDF o fotos de factura → Groq extrae renglones → revisión → aplicar. Modos "Mercancía nueva" (stock+costo+precio, crea productos) y "Actualizar" (solo costo/código, nunca stock/precio ni productos nuevos). **Nunca autovincula por similitud de nombre**: solo por `supplier_code` ya aprendido; el resto se vincula a mano (buscador ordenado por categoría adivinada, escáner por renglón) y ese vínculo enseña el código. Precio sugerido = precio de revista redondeado a pesos; costo exacto. Kits de promoción con componentes vinculables (costo repartido). Chequeo extraído vs. total del documento. Confirmación que señala precio < costo y kits sin vincular. Deshacer sin límite de tiempo (`te_ria_last_undo`). Borrador en localStorage.
- **Captura rápida:** foto + IA → producto.
- **Archivar/Restaurar** desde el Quick View; vista "📦 Archivados". **En bloque, la barra ofrece Archivar** (`bulkArchive`, con Deshacer); el borrado real vive al final de "Más acciones" ("Eliminar definitivamente") con doble confirmación si son más de 10. Antes "seleccionar todo + Eliminar" borraba el catálogo con un solo Aceptar.
- **Orden:** "Editados hace poco" (`recent`, por `recently_edited`) ≠ "Agregados hace poco" (`created-new`).
- **Auditoría de imágenes de Drive** (Configuración → Datos): lista archivos de Drive no usados por ningún producto (requiere `action:'list'` en el Apps Script); nunca borra sin confirmación.
- **Drive:** `drive_ep` + `drive_secret` en `config` (el cliente solo ve `drive_ep`; todo pasa por `drive-proxy`). El Apps Script solo borra archivos de su carpeta (`FOLDER_ID`). **Desde una Edge Function, la redirección 302 del Apps Script se sigue a mano** (`redirect:'manual'` + GET a `Location`, `postToAppsScript()` en `drive-proxy`): si `fetch` la sigue solo, Google responde 404 en HTML. Al cambiar el secreto en el Apps Script hay que crear **nueva versión del despliegue** (Implementar → Administrar implementaciones → editar → Nueva versión) o sigue corriendo el viejo. Instrucciones paso a paso en Configuración → Integraciones. Si Drive falla, se guarda base64 (nunca bloquea).
- Drag & drop para ordenar (`position`) no funciona en iOS; alternativa "📌 Al inicio".

---

## Caja

- **Fiado y saldo a favor** (`pos-fiado.js`, migración `20261010_07`): `sales.se_lo_llevo` = la persona ya se llevó el producto (se marca al crear con "Se lo lleva hoy" o en Editar, `te_set_apartado_se_lo_llevo`, permiso propio **`canGiveCredit` "Dar fiado"** — solo superadmin por defecto, encargadas con PIN — migración `20261010_09`); no reserva en tienda (no cuenta en `is_apartado`), nunca se ofrece liberar, recordatorio de "saldo". **Liberar producto**: apartado no fiado con ≥30 días vencido (`_LIBERAR_DIAS`), siempre manual (ficha y ronda de cobranza) = cancelar con motivo "No pagó (vencido)" y por defecto **el dinero queda a su favor** (`cancel_sale_atomic(p_keep_credit)` → `sales.saldo_favor`, sin devolución). El modal de cancelar pregunta "Queda a su favor / Se lo devuelvo ahora" en todo apartado con dinero. Saldo a favor se ve en Cancelados y se devuelve con `te_refund_credit` (exige caja abierta); para usarlo en una compra se devuelve y se cobra normal. Reactivar lo regresa a pagado. Política decidida por Claude a pedido de Eduardo (2026-10-10): a favor por defecto porque casi nunca está la clienta al liberar. En tarjetas se marca el chip **"En tienda"** (apartado no fiado); la ficha muestra uno u otro. Al liquidar uno En tienda, la confirmación dice "Entrégale su producto: …". Textos al crear: fiado = "Se lo lleva hoy y paga después", en tienda = "El producto queda guardado en la tienda" (también en el WhatsApp).
- **"Solo ver apartados"** (enlace en "Abrir caja"): consultar, recordar y editar sin abrir turno (`_posViewOnly`); abonar, cobrar saldo, cancelar/devolver con dinero y apartado nuevo piden abrir caja (`_posNeedShift`); cerrar Apartados regresa a "Abrir caja". Hubo un "+ Nuevo → Apartado nuevo" y se quitó el 2026-10-10: un apartado empieza en el carrito (productos primero, "Es apartado"); el atajo confundía y no ahorraba pasos. **No reintentar.**
- **Turno obligatorio:** no se vende sin abrir turno (`#open-shift-overlay`, fondo inicial sugerido del último cierre). El turno es de la cuenta, no del dispositivo. Abrir con uno ya abierto **hoy** lo reutiliza (`reused`, otro dispositivo de la misma cuenta); uno de un día anterior se cierra como `cerrado_auto`. **El servidor rechaza vender/abonar sin caja abierta de quien captura** (`te_assert_open_shift`, HINT `shift_closed` → `posRpc` llama `_posShiftLost()` y reaparece "Abrir caja" con aviso); Caja también revisa el turno al volver a primer plano (>30 s) y al abrir el Corte (`_posRecheckShift`). Antes, un dispositivo que no se enteró del cierre seguía cobrando y ese efectivo no salía en ningún corte. Recordatorio no bloqueante a las ≥10 h o ≥21:00 CDMX; si el turno abrió en un día anterior, el aviso no se puede descartar. Cerrar sesión con turno abierto pide confirmación (no obliga a cerrarlo).
- **Corte:** consulta en vivo desde `opened_at`. **Movimientos del turno** (`cash_shift_expenses.kind`): `gasto` y `ingreso` afectan esperado y utilidad; `retiro` (dinero de la tienda que sale del cajón: la dueña se lleva la venta, depósito) solo resta del esperado, va a Actividad (`retiro_efectivo`) y se guarda aparte en `cash_shifts.retiros_total`. **Conteo a ciegas, en dos pasos** ("Mi turno"): paso 1 = fondo, conteo (con separador de miles al escribir; Enter compara) y movimientos, **sin ningún monto cobrado a la vista** (con fondo + efectivo visibles el esperado se saca de cabeza); paso 2, tras "Comparar": diferencia, esperado, resumen de cobros, "Cerrar turno" y "Compartir por WhatsApp" (el mensaje lleva el esperado, por eso también espera). Editar el conteo o un movimiento regresa al paso 1. Sin renglón de "Utilidad" (era cobros − gastos, sin costo: engañosa). "General — hoy" sigue mostrando el resumen directo. "🔒 Cerrar turno" calcula `esperado` en servidor; diferencia ≥ $100 exige `canCloseShiftUnsupervised` o PIN y se marca ⚠️ en Actividad. **El cajón es de quien tiene el turno:** lo que cobra otra cuenta no se espera ahí (en tienda hay una persona a la vez; la dueña puede cobrar fuera con su propio dinero). Preguntar "¿ese efectivo está en tu cajón?" por cada cuenta se quitó por ruido; si la dueña cobra en tienda y deja el efectivo, se registra como "+ Ingreso". El servidor conserva `p_include_cash_from` (el cliente manda null). "Ver cada cobro" (paso 2) lista cada pago del turno. "General — hoy" solo con `canViewReports`. Ubicación GPS opcional (no bloquea) anotada en Actividad si está a >150 m del local (`config.ubicacion_tienda {lat,lng}`; sin dato no se calcula).
- **Catálogo:** orden por recién creado o con precio/stock tocado (`recently_edited`), paginado de 50; búsqueda con texto limitada a 40; OOS ocultos; Frecuentes compacto en mobile; Realtime sincroniza stock entre cajas. Tocar un producto agotado o exceder stock abre "Reabastecer" (suma stock y agrega al carrito).
- **Cobro:** formulario oculto con carrito vacío. Siempre visibles: método (Efectivo/Transferencia/Tarjeta; las que se ven las define `negocio.js` → `formasDePago`, catálogo en `_METODOS_PAGO` de `shared.js`; solo efectivo entra al cajón), efectivo rápido "el siguiente billete" (`_posQuickCashAmounts`: redondea el total a $50/$100/$500/$1,000 según su tamaño — $1,040 → 1,100 · 1,500 · 2,000), "Es apartado". En "Más opciones" (con contador): descuento, nota, cliente (nombre+teléfono; reconoce clientes conocidos), "Ya lo cobró <dueña>". Precio editable tocando el precio del carrito (con 1 pieza no se muestra "c/u": se toca el precio de la derecha). El botón dice el monto ("Cobrar $1,040"); con descuento, un solo total con el original tachado; el cambio es texto grande ("Faltan $X" si no alcanza); efectivo recibido con separador de miles.
- **"Ya lo cobró <dueña>"** (`negocio.js` → `duena`; vacío = no aparece): atribuye el cobro (`p_collected_by_email`) a la dueña para que no cuente en el efectivo del turno de quien captura. El servidor solo acepta atribuir a un superadmin. Actividad conserva quién tecleó.
- **Escáner:** iOS → Quagga2 (`locate:true`, sin `area`); Android/desktop → Html5Qrcode (`useBarCodeDetectorIfSupported:true`, `qrbox 260×100`). La cámara se queda abierta tras acierto o fallo (cooldown); se cierra solo si va a mostrar un error/reabastecer que quedaría tapado. Contextos: carrito y "Editar apartado".
- **Apartados:** nombre obligatorio, anticipo puede ser 0, fecha límite (default 30 días). Activos/Liquidados/Cancelados con filtros Vencidos/Próximos 7 días/Sin fecha (con conteo; "Sin fecha" solo si hay). "Todos" va por urgencia (vencidos primero). Tarjetas: color solo cuando importa (solo la fecha en rojo si venció, ámbar ≤7 días; "Falta $X" siempre neutro desde 2026-10-10), sin teléfono, sin repetir "Liquidado/Cancelado" en su pestaña. Montos con `_fmtMx()` ($40,749.80). Nombres de clienta con mayúscula inicial al guardar (`_titleCaseName`). **Detalle:** en celular y escritorio es el mismo (`openAptDetail`); en celular se abre como hoja desde abajo con acciones fijas al pie (antes se desplegaba dentro de la lista y los botones quedaban fuera de pantalla — no regresar al acordeón). Cancelar usa el ícono ⊘, nunca ✕. Abonar, liquidar, editar (productos, nombre, teléfono, fecha límite — nunca recalculada sola; total no puede quedar menor a lo pagado), cancelar, reembolsar. **Cancelar** (apartado o venta, desde la ficha o desde Historial) usa un solo modal: motivo obligatorio y, si hay dinero, casilla de "confirmo que devuelvo $X". **Reactivar** un apartado cancelado: solo superadmin, revierte la devolución con un `adjustment` en la misma fecha y a la misma cajera, rechaza si el stock ya no alcanza. Vencidos: número rojo en la pestaña "Apartados" de abajo (mobile; el banner rojo diario se quitó el 2026-10-10 por ruido) y chip en topbar (tablet/desktop). **Ronda de cobranza** ("Recordar a vencidas (N)" en Apartados): lista de vencidos, primero a quien no se le escribió hoy; cada recordatorio (también el de la ficha) se registra como `recordatorio_enviado` y `te_apartado_reminders()` da la última vez/quién/cuántas a cualquier cajera. Apartados activos se cargan paginados (sin tope de 100).
- **Comprobantes por WhatsApp:** tras abono, liquidación o apartado nuevo se ofrece enviar recibo (cerrar sin enviar pide confirmación; ambos se registran en Actividad). "Reenviar comprobante" en Historial y en el detalle del apartado reconstruye el recibo desde la BD con el saldo pendiente **de esa fecha**; si no hay teléfono, lo pide solo para ese envío.
- **Historial:** movimientos de `sale_payments` agrupados por fecha real; devoluciones multimétodo como una operación; ver historial de la transacción, reenviar y **cancelar (ícono ⊘, al final)** en el pie de la tarjeta; nunca una ✕ junto al monto (se leía como "cerrar").
- **Ticket WA post-venta:** el modal no se cierra tocando fuera ni con Escape. En una venta ofrece **"Era apartado"**: cancela la venta (motivo "Era apartado", mismo permiso/PIN) y regresa los productos al carrito con "Es apartado" activo.
- Transferencia: oculta efectivo/cambio y avisa "pendiente confirmar recibo".

---

## Reportes

- Períodos Día/Semana/Mes navegables (el modo se recuerda en `te_stats_mode`; el desplazamiento siempre vuelve a 0). Zona `America/Mexico_City`.
- **Dinero:** Ingresos = suma de `sale_payments` por `paid_at` (devoluciones restan). Tres cubetas excluyentes que suman Ingresos: **Ventas** (venta directa + liquidación), **Abonos** (a apartados creados antes de ese día), **Apertura** (anticipo del día en que se abre el apartado, `_isSameDayOpeningPayment`). Si un cobro y su devolución caen en el mismo período, el cobro se excluye de Ventas/Abonos; si caen en períodos distintos, cada período conserva su cifra. Una reactivación compensa su devolución.
- Ventas/unidades cuentan al completarse (`created_at` directa, `liquidated_at` apartado). Un fallo de consulta muestra "No disponible", nunca 0.
- Montos sin centavos (`maximumFractionDigits:0`), **excepto Turnos de caja**, donde una diferencia de centavos es información real.
- Dos zonas: arriba la historia del período; abajo lo operativo, con lo que pide atención primero (Turnos de caja, Apartados pendientes, Por caducar, Estado del inventario) y luego consulta (Valor en venta, Clientes frecuentes, Rentabilidad). Turnos muestra esperado, retiros y efectivo de otras cuentas de cada cierre. Turnos solo cuenta desde `config.turnos_desde` si existe (para ignorar una etapa de prueba). Cards: Dinero de hoy (hero + barra de composición solo con ≥2 segmentos + sparklines ≥1300px), Otros indicadores (artículos, por cobrar con barra vencido/al corriente), Movimientos de hoy, gráficas (hora/día, categoría, día de semana, mapa del mes), Top productos, Apartados pendientes, Productos por caducar, Clientes frecuentes (perfil editable: nombre, teléfono, notas), Turnos de caja (acumulado por cajera, diferencias), Estado del inventario, Valor en venta por categoría (`price×stock`), Rentabilidad, Por vendedor.
- **Inventario de Reportes** (Estado del inventario, Valor en venta, Rentabilidad, Por caducar) usa `_invProducts()`: sin archivados ni kits, mismos criterios que Inventario → Pendientes. `products` completo solo para nombres/categorías de ventas pasadas. Rentabilidad enlaza a `admin.html#pendiente=sin-costo` (Inventario abre con ese pendiente; sirve con cualquier clave de `_PEND_ITEMS`).
- **Listas largas en celular** (Movimientos, Turnos, Apartados, Valor por categoría, Clientes): sin scroll interno; primeros renglones + "Ver todo / Ver menos" (`_mobileListExpanders`). En escritorio conservan su scroll interno.
- Chart.js lee colores con `_cssVar()` (`_brand()`/`_brandA(a)` para el color de marca) y se repinta al cambiar el tema (MutationObserver). Mapa del mes: 5 tonos del color de marca.
- Una venta guarda el renglón sin categoría: si el producto se borra, Reportes la muestra como "Otro" (mejora pendiente: guardar la categoría en el renglón).

---

## Tienda

- Anon key; carga campos específicos (nunca `select=*`). Orden default `position.asc` ("Nuestra selección").
- "Todo" muestra 12 + "Ver más"; filtrando/buscando, sin límite. Filtro de categoría jerárquico (`catMatchesFilter`, usa `publicCategories`).
- **Carrito "Mi pedido"** (`localStorage.te_cart`): tope por stock, se reconcilia con el catálogo al abrir, un solo mensaje de WhatsApp. WhatsApp directo de un producto desde el modal; productos "📌 Apartado" solo "Consultar".
- **Modal 3 zonas:** imagen (`object-fit:contain`, galería con dots) / info con scroll / CTA fijo. Bottom sheet en mobile; swipe y teclas ←/→ navegan productos.
- **Kits:** la Tienda solo ofrece kits con todos sus componentes disponibles (`_fetchProductsList`); antes un kit con un componente agotado salía disponible y se podía pedir.
- **Fotos cuadradas (de Tres Encantos, 2026-10-14):** al subir en Inventario quedan cuadradas sin recortar (`_squareImageDataUrl`, `admin-form.js`/`admin-capture.js`, relleno con el color del borde). En la Tienda, las fotos de Drive se piden directo a `lh3.googleusercontent.com` (manda CORS) y `_fitPhoto` (`app.js`) rellena el hueco de las no cuadradas con un degradado que sigue el borde, o color liso si el borde tiene textura; `crossorigin` solo en lh3 (`_co`). Las 4 primeras fotos de la cuadrícula y las de la portada van con `fetchpriority="high"`.
- "⚡ Última pieza disponible" cuando `stock===1 && !isApartado` (tarjeta, modal y mensajes WA). Nunca "pieza única".
- Badges: descuento % gana sobre badge `promo`; otros badges conviven con el %.
- **Contenido desde `NEGOCIO.tienda`** (`_aplicarNegocioTienda()` en `app.js`): `[data-t="ruta"]` recibe el texto (`*x*` = cursiva de marca, `\n` = salto), `[data-wa="mensaje"]` el enlace de WhatsApp, y las secciones sin datos quedan `hidden` (Nosotros, local, redes, marca por catálogo y sus enlaces del menú/pie). El pie lista las categorías raíz.
- **Marca por catálogo** (antes Natura): `tienda.catalogo.marca` + `categoria` → sección con carrusel (8 primeros por `position`) y la revista de Configuración. Barra admin solo con sesión válida. Acceso staff: candado discreto en el header. WhatsApp flotante solo ≤768px.

---

## Actividad y Configuración

- **Actividad:** feed de `activity_log` (300), filtros período/usuario/tipo, búsqueda (incluye productos dentro de ventas vía RPC `te_search_activity_meta`), resumen KPIs, chip "Fuera de horario" (ícono de luna; 23:00–06:00, excluye a las superadmin de `user_permissions`). **Todo `logActivity()`/acción nueva necesita su entrada en `ACTION_CFG` (`activity.js`)**, o cae como badge genérico.
- **Configuración** (acceso según `canManageSettings`, o parcial con `canManageCatalogSettings` → solo Catálogo, o `canImportExport` → solo Datos):
  - Catálogo: toggles (WhatsApp flotante, Captura rápida, Ver creador, Reabastecimiento, Recibir mercancía, Recepción con IA), categorías, revista o catálogo digital.
  - Usuarios y Permisos: crear usuario, rol, permisos (lista/matriz), copiar permisos de otra persona, revertir uno o todos.
  - Datos: catálogo JSON (exportar/importar; importar nunca publica sin `isPublished:true` explícito), apartados y pagos en CSV (con `canViewReports`), **Exportar todo** (incluye secretos; solo `canManageSettings`; no es restauración — la recuperación real es el backup de Supabase), nombres de usuarios, duplicados, auditoría de Drive, limpiar historial (solo superadmin).
  - Integraciones: Groq key, Google Drive.
  - **Navegación** (`settings-nav.js`, traído de Tres Encantos 2026-10-14): celular = índice de secciones y cada una se abre sola con "‹ Configuración"; escritorio (≥900px) = menú fijo a la izquierda. Direcciones `#usuarios #avisos #catalogo #datos #integraciones`. Con una sola sección permitida abre directo.
  - **Avisos al equipo** (`settings-avisos.js`, solo `canManageSettings`): publicar/editar/quitar avisos de la campana con vista previa, y ver quién los leyó y a quién le falta.
- **Campana** (`shared.js`): muestra los avisos de `team_notices` (por módulo: `pos*` = caja, `admin*` = inventario; `SYS_NOTICES` vacío, no agregar ahí). **Reglas:** lo ve toda cuenta con sesión desde que se publica hasta `until` inclusive (hora CDMX) o hasta que se quita; **leído = desplegado**; leído y descartado (✕) son **por persona en el servidor**, no por dispositivo (dispositivo compartido en tienda); la copia local va marcada con el correo; a la autora su aviso no le cuenta como pendiente. Avisos cortos: los pasos van en Ayuda ("Ver cómo en Ayuda" → `openHelp(help_query)`).
- **Avisarme al vender**: sondeo cada 25 s solo con la app abierta; más de 3 movimientos juntos llegan como un resumen; ícono en `img/icono-192.png`.

---

## Convenciones de código

- **XSS:** todo string de BD/usuario que entre por `innerHTML` pasa por `_esc()` (`escH()` en settings.js). En `onclick="fn('…')"`: `_esc(x).replace(/'/g,"\\'")`.
- **Drive:** toda imagen mostrada pasa por `_driveSz(url, w)` con `w` ≈ tamaño renderizado (80 thumbs, 300 cards, 400 popups, 900 principal).
- **fetch con timeout:** todo `fetch` a Supabase/Apps Script usa `AbortController` (`_posFetchTimeout`, `_statsFetchTimeout`, etc.). Sin eso, una conexión colgada deja la UI en "Guardando…" para siempre.
- **ReferenceError silencioso:** una función global no definida dentro de `init()` aborta el resto sin mensaje — si una sección se queda en "Cargando…", revisar consola. `toast()` no existe en Reportes ni Actividad: desde `shared.js` usar `window.toast?.()`.
- **Service Worker:** cachea todos los archivos propios (stale-while-revalidate). **Tras cambiar JS/HTML/CSS, subir `CACHE_VERSION` en `sw.js`.** El usuario puede necesitar recargar dos veces.
- **Sistema de diseño — `tema.css` (2026-10-13):** único lugar con valores de diseño; se carga primero en todas las páginas. Colores (`--brand*` de `negocio.js`, neutros, `--tint-{red,amber,green,blue,violet}-{bg,border,strong}`), esquinas `--radio-{xs,sm,md,lg,xl,pill}` (4/8/12/16/20/999), sombras `--sombra-{1,2,3}`, en claro y oscuro. **Nunca escribir un color, esquina o sombra suelto**: usar la variable; si falta un valor, agregarlo en `tema.css`. `python scripts/tokenizar_css.py` convierte lo que se cuele. Regla de botones: acción principal = `--brand`; selección (segmentos, filtros activos) = `--ink`; avisos flotantes = `--ink`; encabezados de ventana claros (`--surface`).
- **Modo oscuro** (los 5 módulos admin): `data-theme-ready="1"` + script anti-flash en `<head>`; `:root[data-theme="dark"]` en cada CSS; tintes `--tint-{red,amber,green,blue,violet}-{bg,border,strong}`. Usar tokens (`--surface`, `--surface-soft`, `--charcoal`, `--muted`, `--border`), no hex. **Fondo oscuro fijo = `var(--ink)`, nunca `var(--charcoal)`** (este se invierte). Un `style=""` inline no responde al tema: mover a clase. Elementos sobre fotos (fondo blanco) usan colores fijos. Fotos de producto con `object-fit:contain` sobre `#fff`.
- **PostgREST:** batch PATCH con máx. 10 ids en `in.(…)`; no se puede castear columnas dentro de `or=(…)` (usar RPC); RPC por `POST /rest/v1/rpc/<nombre>` con argumentos nombrados.
- **Gestos:** handlers `{passive:true}`, sin `stopPropagation` en swipes; detectar dirección en `touchmove`.
- **Ayuda** (`openHelp()` en `shared.js`, "Ayuda" en el menú del avatar, los 5 módulos): buscador sobre `assets/MANUAL.md` (cada `###`, cada `##` sin subtemas y cada pregunta en negritas de "Preguntas frecuentes" es una entrada). Ignora acentos, entiende familias de palabras y sinónimos (`_SINONIMOS`); sin búsqueda muestra primero el módulo actual. **El manual es la ayuda: todo cambio que el equipo deba saber se escribe ahí.**
- **Diálogos:** nunca `alert()`/`confirm()` nativos (salen como cuadro gris del navegador, sin tema ni tamaño de letra): usar `await teConfirm({title, message, confirmText, danger})` / `await teAlert(msg, title)` de `shared.js`; validaciones menores con `toast`. Todos los módulos migrados (2026-10-07): no queda ningún nativo. Al volver `async` una función por usar `teConfirm`, revisar si alguien usa su valor de retorno (`closeForm()` devuelve si cerró).
- **Campos de dinero** (Caja): clase `.money-field` (`pos.css`) = monto grande junto a su "$". En celular Caja fuerza 16px en inputs (anti-zoom iOS) con `!important`; para agrandar un campo hay que igualar esa especificidad (`:not([type=checkbox])`). Piezas siempre "pzas" (nunca "uds").
- **Offline:** banner en `shared.js` (y copia en `app.js`); `cobrar()` bloquea sin conexión.
- Scripts CDN pesados (supabase-js, html5-qrcode, Quagga2) se cargan con `_loadScript()` al necesitarlos.

---

## No reintentar (probado y descartado)

- **Escáner:** Quagga2 para todos los dispositivos, o "afinar" Quagga (resolución/foco/consenso/`locate:false`+`area`) → peor en Android real. Quitar `useBarCodeDetectorIfSupported` tampoco ayudó. El split iOS/Android actual es el validado.
- **Groq:** `reasoning_effort` distinto de `'none'` rompe el modo JSON estricto ("Failed to validate JSON"). Groq retira modelos preview sin aviso (Llama 4 Scout → qwen3.6 → qwen3.8): si la IA falla con "model does not exist", revisar el modelo primero.
- **Similitud de nombres ponderada por rareza** (3 variantes) no resolvió casos reales; se quedó `_wordSim` simple. **Autovincular en Recepción con IA por score de nombre** elige mal productos de la misma línea.
- **IA "¿son el mismo producto?"** en duplicados: poco confiable, eliminada.
- **Carga masiva con IA**, **checador de entrada/salida**, **"Marcar como prueba" (`is_test`)**, botones de orden **AZ/Recientes** y carril **"Recién preparados"** en Caja: eliminados a propósito.
- **Tinte de color permanente en chips de estado** y **botón IA charcoal+dorado**: rechazados por minimalismo.
- **Auto-cerrar turnos por tiempo** (fabricaría un conteo falso) y **avisar en `beforeunload`** (poco confiable en móvil): descartados.
- Concepto "Borrador" y chip "Con stock": eliminados por redundantes.

---

## Pendientes

Ver [PLAN.md](PLAN.md). Además:
- **Nunca escribir secretos en archivos versionados** (la copia del Apps Script usa `PEGA_AQUI_EL_SECRETO`; tokens en `~/`).
- Duplicar producto **no** copia `supplier_code` a propósito: el código enseña a Recepción con IA a qué producto vincular, duplicarlo lo volvería ambiguo.
- Auditoría de Drive (Configuración → Datos) cada 1–2 meses por negocio.
- Antes de usar el proyecto de Pruebas con un cliente real: rotar su JWT secret (se mostró en una sesión).
