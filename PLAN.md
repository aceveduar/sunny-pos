# Plan — Sunny POS

Sistema de punto de venta + inventario + reportes + tienda en línea con pedido por WhatsApp,
para tiendas chicas (boutiques, accesorios, belleza). Nació como copia de Tres Encantos
(2026-10-13). Cada negocio tiene su propio proyecto de Supabase, su Apps Script de Drive y su
`negocio.js`; el resto del código es igual para todos.

`[x]` hecho · `[ ]` pendiente · **(Eduardo)** = lo hace Eduardo, Claude lo guía.

## 1. Separar el proyecto de Tres Encantos
- [x] Copia sin historial de git ni datos de Tres Encantos
- [x] `negocio.js`: dirección y llave de Supabase en un solo lugar (vacías = aviso en pantalla)
- [x] Google Analytics opcional (`NEGOCIO.analyticsId`)
- [x] **(Eduardo)** Crear repo privado en GitHub `sunny-pos` (github.com/aceveduar/sunny-pos)
- [x] **(Eduardo)** Crear proyecto nuevo en Supabase para pruebas (`Sunny POS Pruebas`, org Sunname Technologies, ref `aduahsqbmborplojhubw`)

## 2. Base de datos instalable
- [x] Sacar de Tres Encantos un solo SQL con toda la estructura (sin datos): `supabase/instalar/01_estructura.sql`, generado con `scripts/instalar/` (instalado en Pruebas 2026-10-13)
- [ ] Mejoras al modelo de datos (ahora que está vacía):
  - [x] A. Sin tocar la app (`scripts/instalar/mejoras.sql`, aplicado y probado en Pruebas 2026-10-13): índices faltantes, código de barras único, precios/stock no negativos, fechas obligatorias
  - [ ] B. Con cambios chicos en la app: tabla de categorías (adiós productos huérfanos), quitar columnas viejas (`sales.type`, `abonos`, `legacy_key`, `is_estimated`, `category_label`), método Tarjeta
  - [ ] C. Grandes, decidir después: personas por id y no por correo; renglones de venta en su propia tabla (`sale_items`) para reportes rápidos; reportes calculados en el servidor
- [x] Datos iniciales: categorías genéricas, configuración por defecto (`02_datos_iniciales.sql`; dueña con `03_primera_duena.sql`)
- [x] Probarlo en el proyecto nuevo y crear la primera cuenta (dueña): eacevedo@ — producto, venta, turno y Reportes OK (2026-10-13)
- [x] Desplegar las Edge Functions (`create-user`, `groq-proxy`, `drive-proxy`): sin secretos manuales (usan la service role que inyecta Supabase)
- [ ] **(Eduardo)** Apps Script de Drive para el negocio de prueba
- [ ] Control de versiones de la base (qué cambios tiene cada negocio)

## 3. Quitar lo que es solo de Tres Encantos
- [ ] Tienda: nombre, logo, portada, "Nosotros", WhatsApp, redes, dirección → configurables
- [ ] Quitar foto/historia de Ofelia, Facebook, Maquixco, textos de Natura en `index.html`
- [x] "Ya lo cobró Ofelia" → "Ya lo cobró [dueña]" configurable (`negocio.js` → `duena`)
- [x] Correos y horarios fijos en `activity.js` (dueñas = superadmin de `user_permissions`)
- [x] Ubicación de la tienda → `config.ubicacion_tienda` `{lat,lng}` (sin dato no avisa) — falta capturarla en Configuración
- [ ] Natura/Avon/revista → opcional ("marca por catálogo")
- [ ] `manifest.json`, íconos, `og:*` (títulos de páginas y nombre en mensajes de WhatsApp: listos, salen de `negocio.js`)
- [ ] `MANUAL.md` genérico
- [ ] Scripts: respaldo y pruebas sin cuentas/nombres de Tres Encantos (pruebas listas: personas temporales + kits/apartados; falta respaldo)
- [ ] Reescribir `CLAUDE.md` para Sunny POS

## 4. Módulos que se prenden y apagan
- [ ] Lista de módulos en `negocio.js` / `config`: Tienda, Fiado, Recepción con IA, Marca por catálogo
- [ ] Tienda apagada: sin ícono, la dirección principal lleva al inicio de sesión, sin "Publicar en web"

- [ ] Quitar la Libreta (apartados de papel) del código: no se usará

## 5. Orden en el código (sin framework)
- [ ] Juntar en `shared.js` lo repetido: `_esc`, `api`, `_driveSz`, `toast`

## 6. Lo que falta para vender
- [ ] Forma de pago Tarjeta
- [ ] Importar productos desde Excel/CSV
- [ ] Asistente de primer uso (nombre, logo, categorías, equipo, primera caja)
- [ ] Negocio demo con datos ficticios
- [ ] Aviso de privacidad y términos
- [ ] **(Eduardo)** Nombre definitivo (hoy "Sunny POS" es de trabajo), antes de logo, dominio o primera venta
- [ ] Precio y planes (básico / con tienda / diseño a la medida aparte)
- [ ] Instalarlo a un segundo negocio piloto

## 7. Ropa y calzado: tallas, colores y tamaños (variantes)
**Problema:** hoy cada producto es un renglón con su stock. Una blusa en 4 tallas × 3 colores serían 12 productos sueltos: la Tienda mostraría 12 tarjetas casi iguales y nadie sabría qué tallas quedan.

**Estrategia (modelo Shopify: producto + variantes):**
- Cada variante sigue siendo un producto completo (su stock, código de barras y precio), pero ligado a un **producto padre** (`variant_of` → products.id) con sus atributos (`variant` jsonb: `{"Talla":"M","Color":"Negro"}`). El padre guarda lo común: nombre, descripción, fotos y categoría; no se vende directo (como los kits).
- **Por qué así:** ventas, apartados, kits, stock y escáner ya funcionan por producto. Las RPC de Caja no cambian, y cada talla tiene su propio código de barras para escanear.
- **Atributos por categoría** en `config` (`variant_templates`): Ropa → Talla + Color; Calzado → Número + Color; Bolsos → Tamaño + Color; Perfumes → Presentación. Con tallas sugeridas (CH/M/G/EG, 22–27) que la dueña ajusta.
- **Inventario:** "Crear variantes" = elegir tallas × colores → se generan todas de un jalón, y el stock se captura en una **matriz** (filas = talla, columnas = color). El padre muestra el total y "faltan: M negro, G rosa".
- **Caja:** buscar "blusa lino" muestra cada variante ("Blusa lino · M · Negro · 2 pzas"); escanear la etiqueta agrega la variante exacta.
- **Tienda:** una sola tarjeta por padre; en el modal, botones de talla y color (las agotadas tachadas); el WhatsApp dice talla y color.
- **Reportes:** ventas agrupadas por padre y "lo que más se vende por talla", para saber qué resurtir.
- **Etiquetas:** imprimir código de barras por variante (fase posterior).

**Fases:** 1) modelo + matriz en Inventario · 2) Caja · 3) Tienda · 4) Reportes por talla.

## 8. Rapidez (máxima velocidad de carga)
**Punto de partida (2026-10-13, 5,000 productos, PC de Eduardo, sesión real):** Inventario 7–8 s · Caja ~5 s · Reportes ~6 s · Actividad ~6 s · Configuración ~4.5 s. Inventario descarga ~4 MB.
- [ ] Medir con un script repetible (Playwright) antes y después de cada cambio.
- [ ] Pedir solo las columnas que cada pantalla usa (Inventario hoy pide `select=*`).
- [ ] Páginas de 1,000 en paralelo, no una tras otra.
- [ ] Mostrar al instante la copia guardada y actualizar por detrás (Inventario y Caja).
- [ ] Miniaturas del tamaño real en pantalla (las fotos de 1000 px para una miniatura de 80 px pesan de más; Drive ya usa `_driveSz`).
- [ ] Reportes: que el servidor sume (RPC por día/categoría/producto) en vez de bajar todas las ventas.
- [ ] Cargar Chart.js y librerías pesadas solo cuando se necesitan; revisar el orden de scripts.
- [ ] Copia sin conexión que no se rompa arriba de ~6,000 productos (IndexedDB en vez de localStorage).

