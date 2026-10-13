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
- [ ] Desplegar las Edge Functions (`create-user`, `groq-proxy`, `drive-proxy`)
- [ ] **(Eduardo)** Apps Script de Drive para el negocio de prueba
- [ ] Control de versiones de la base (qué cambios tiene cada negocio)

## 3. Quitar lo que es solo de Tres Encantos
- [ ] Tienda: nombre, logo, portada, "Nosotros", WhatsApp, redes, dirección → configurables
- [ ] Quitar foto/historia de Ofelia, Facebook, Maquixco, textos de Natura en `index.html`
- [ ] "Ya lo cobró Ofelia" → "Ya lo cobró [dueña]" configurable (`pos-core.js`)
- [ ] Correos y horarios fijos en `activity.js`
- [ ] Ubicación de la tienda (aviso GPS al cerrar turno) fija en `_te_distance_to_store_m` → configurable
- [ ] Natura/Avon/revista → opcional ("marca por catálogo")
- [ ] `manifest.json`, íconos, títulos de páginas, `og:*`
- [ ] `MANUAL.md` genérico
- [ ] Scripts: respaldo y pruebas sin cuentas/nombres de Tres Encantos
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
