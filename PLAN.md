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
  - [ ] B. Con cambios chicos en la app: quitar columnas viejas (`sales.type`, `abonos`, `legacy_key`, `is_estimated`, `category_label`). Hecho 2026-10-16: método Tarjeta, y los huérfanos de categoría se resolvieron sin tabla nueva (eliminar mueve a Sin categoría; Pendientes los detecta).
  - [ ] C. Grandes, decidir después: personas por id y no por correo; renglones de venta en su propia tabla (`sale_items`) para reportes rápidos; reportes calculados en el servidor
- [x] Datos iniciales: categorías genéricas, configuración por defecto (`02_datos_iniciales.sql`; dueña con `03_primera_duena.sql`)
- [x] Probarlo en el proyecto nuevo y crear la primera cuenta (dueña): eacevedo@ — producto, venta, turno y Reportes OK (2026-10-13)
- [x] Desplegar las Edge Functions (`create-user`, `groq-proxy`, `drive-proxy`): sin secretos manuales (usan la service role que inyecta Supabase)
- [ ] **(Eduardo)** Apps Script de Drive para el negocio de prueba
- [ ] **Probar `01_estructura.sql` regenerado (2026-10-15, trae variantes y avisos) en un proyecto de Supabase vacío** antes de instalarlo a un cliente.
- [ ] Control de versiones de la base (qué cambios tiene cada negocio)

## 3. Quitar lo que es solo de Tres Encantos
- [x] Tienda: nombre, logo, portada, "Nosotros", WhatsApp, redes, dirección → configurables (`NEGOCIO.tienda`; lo vacío se oculta)
- [x] Quitar foto/historia de Ofelia, Facebook, Maquixco, textos de Natura en `index.html`
- [x] "Ya lo cobró Ofelia" → "Ya lo cobró [dueña]" configurable (`negocio.js` → `duena`)
- [x] Correos y horarios fijos en `activity.js` (dueñas = superadmin de `user_permissions`)
- [x] Ubicación de la tienda → `config.ubicacion_tienda` `{lat,lng}` (sin dato no avisa) — falta capturarla en Configuración
- [x] Natura/Avon/revista → opcional ("marca por catálogo": `NEGOCIO.tienda.catalogo`)
- [x] `manifest.json`, íconos genéricos, títulos y mensajes de WhatsApp. Pendiente por negocio: `og:*` de `index.html` y sus íconos (WhatsApp no ejecuta JS)
- [x] `MANUAL.md` genérico (sin libreta; corte actualizado)
- [x] Scripts: respaldo (`scripts/respaldo.py`, cualquier negocio vía negocio.js) y pruebas sin cuentas de Tres Encantos
- [ ] **(Eduardo)** Tarea programada diaria del respaldo
- [x] Reescribir `CLAUDE.md` para Sunny POS

## 4. Módulos que se prenden y apagan
- [x] Módulos en `negocio.js → modulos` (2026-10-16): `tienda` y `fiado`. Recepción con IA ya tenía su interruptor (Configuración → Catálogo) y la marca por catálogo se apaga con `tienda.catalogo` vacío.
- [x] Tienda apagada: sin ícono, la dirección principal lleva al inicio de sesión, sin Publicar/Ocultar, Compartir ni "Sin publicar"; Configuración esconde WhatsApp flotante y revista. Fiado apagado: sin "Se lo lleva hoy".

- [x] Quitar la Libreta (apartados de papel) del código: pantalla, archivo, interruptor, funciones en la base y pruebas

## 5. Orden en el código (sin framework)
- [x] Juntar en `shared.js` lo repetido (2026-10-16): `_esc` y `_driveSz` (eran iguales en 4 y 3 módulos). `api` y `toast` se quedan por módulo: cada uno tiene su token/renovación y Caja usa toasts con botón.

## 6. Lo que falta para vender
- [x] Forma de pago Tarjeta (2026-10-16): `sale_payments.method` acepta `tarjeta` (mejoras.sql reescribe las RPC de cobro desde su definición); Caja, corte, historial, Reportes, Actividad y CSV la muestran; no entra al cajón (prueba en caja.sql); `negocio.js → formasDePago` la oculta si el negocio no tiene terminal.
- [x] Importar productos desde Excel/CSV (2026-10-16, `admin-importar.js`, + Agregar → Desde Excel, permiso canImportExport): SheetJS, reconoce columnas por título, CSV en UTF-8 o Windows-1252, montos con $ y comas, plantilla descargable, tallas/colores → prenda, código existente: saltar o actualizar, categoría desconocida → Por revisar.
- [x] Asistente de primer uso (2026-10-16, `admin-primeros.js`): guía "Primeros pasos" arriba de Inventario para quien administra (productos, categorías, equipo, primera venta, compartir Tienda, Ayuda); se marca sola y se oculta (`config.primeros_pasos`). Nombre, logo y color van en `negocio.js` al instalar.
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

**Decisión (2026-10-15): sin producto padre.** Cada variante es un producto normal y las de una prenda comparten `variant_group`; `variant` = lista ordenada `[["Talla","M"],["Color","Negro"]]` (un objeto jsonb reordena las llaves); `variant_base` = nombre sin variante. Ventas, apartados, kits, escáner y reportes siguen igual; solo se agrupa la vista.

**Fases:**
- [x] 1) Modelo en base + "Con tallas o colores" en Inventario (cuadrícula de piezas) + cuadrícula editable en la ficha.
- [x] 1b) Lista de Inventario agrupada por prenda (un renglón: variantes, piezas totales, Web; la casilla selecciona la prenda completa; si el filtro deja una sola variante, se ve esa).
- [x] 2) Caja: funciona sin cambios (el nombre incluye talla y color); las tallas de una prenda salen juntas y en orden.
- [x] 3) Tienda: una tarjeta por prenda ("4 tallas · 2 colores", "Desde $X", "Elegir talla"); en la ficha, botones por opción con las agotadas tachadas; carrito y WhatsApp con la variante exacta.
- [x] 3b) Después del alta (2026-10-15): "+ Talla o color" y "+" en casillas faltantes (nacen con 0 pzas), foto por color desde la cuadrícula, y editar una variante (formulario, precio/nombre/categoría rápidos, Ocultar/Publicar) pregunta si aplicar a toda la prenda (la foto solo al mismo color). Tallas ordenadas (CH<M<G, números). Drive no borra una foto que otra variante sigue usando. Duplicados ignora hermanas.
- [x] 3c) Códigos de barras por talla/color (2026-10-16): la cuadrícula de la ficha cambia a "Códigos" (escanear o escribir, Enter = siguiente, rechaza repetidos) y "Crear códigos" genera EAN-13 internos (empiezan con 2) para la ropa sin código. Recibir mercancía y Caja ya los encuentran porque cada variante es un producto. Tras crear una prenda se abre su ficha.
- [x] 4) Reportes (2026-10-16): tarjeta "Tallas y colores" (piezas por talla en su orden, por color, por número…, y "Se vendieron y ya no quedan"); Productos más vendidos suma cada prenda con su talla/color más vendida. Solo aparece si se vendió algo con variantes. Ventas demo: 25% prendas.
- [x] 5) Juntar productos sueltos (2026-10-16): selección → Más acciones → "Juntar en una prenda" adivina nombre común, talla/número y color (corregibles), valida combinaciones repetidas; sirve también para sumar un suelto a una prenda. Ficha → Más → "Quitar de la prenda".
- [x] 6) Etiquetas (2026-10-16, `admin-etiquetas.js`): ficha → Más → Etiquetas (prenda = todas sus variantes) y selección → Imprimir etiquetas. Hoja carta 3×10 (66.7×25.4 mm) o rollo térmico 50×25 mm; una por pieza o una de cada; EAN-13/Code 128 con JsBarcode; ofrece crear códigos faltantes. Falta probar en impresora real.
- [x] 4) Reportes por talla (ver 4 arriba).

## 8. Rapidez (máxima velocidad de carga)
**Punto de partida (2026-10-13, 5,000 productos, PC de Eduardo, sesión real):** Inventario 7–8 s · Caja ~5 s · Reportes ~6 s · Actividad ~6 s · Configuración ~4.5 s. Inventario descarga ~4 MB.
**Con 4G simulado (2026-10-15):** Inventario 6.1 → 0.45 s · Caja 2.9 → 0.38 s · Reportes 2.4 → 0.8 s · Actividad 1.7 → 0.5 s · Tienda 1.8 → 0.9 s (Inventario/Caja: al volver a abrir; la primera vez ~2 s).
- [x] Medir con un script repetible: `scripts/medir_rapidez.py` (4G simulado; resultados en `scripts/rapidez/`).
- [x] Buscador de duplicados de Inventario: bloqueaba 3.5 s al abrir; ahora corre después y tarda 0.5 s.
- [x] Actividad ya no espera al catálogo para mostrar la lista.
- [ ] Pedir solo las columnas que cada pantalla usa (Inventario hoy pide `select=*`).
- [x] Páginas de 1,000 en paralelo, no una tras otra (Inventario, Tienda y `_posPaginatedFetch` para Caja/Reportes/Configuración/Actividad).
- [x] Mostrar al instante la copia guardada y actualizar por detrás (Inventario y Caja, IndexedDB).
- [ ] Miniaturas del tamaño real en pantalla (las fotos de 1000 px para una miniatura de 80 px pesan de más; Drive ya usa `_driveSz`).
- [x] Reportes: el dinero se pinta sin esperar al catálogo, a Turnos ni a Clientes frecuentes (esas tarjetas se llenan al llegar).
- [ ] Reportes con años de historia: que el servidor sume (RPC) Turnos de caja y Clientes frecuentes, que hoy bajan toda la historia (ya no frenan la pantalla, pero crecen sin límite). Hacerlo cuando un negocio pase de ~1 año de datos.
- [ ] Cargar Chart.js y librerías pesadas solo cuando se necesitan; revisar el orden de scripts.
- [x] Copia sin conexión que no se rompa arriba de ~6,000 productos (IndexedDB en vez de localStorage).

## Para corregir también en Tres Encantos (anotado desde Sunny POS)
- **Realtime entra como anon** (`initRealtime()` en `admin.js` y `pos-core.js`): el header `Authorization` de `createClient` no aplica a Realtime; sin `client.realtime.setAuth(token)` los cambios llegan con los permisos de anon. En Sunny (anon sin columnas internas) llegaban sin costo/código y los borraban en pantalla: en Caja el escáner dejaba de encontrar un producto después de venderlo, y guardar desde Inventario podía dejar el costo vacío. En Tres Encantos revisar si anon ve `cost`/`barcode` por Realtime (fuga de costo a la Tienda) y aplicar el mismo arreglo (Sunny, 2026-10-16).

