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
- [ ] **(Eduardo)** Crear repo privado en GitHub `sunny-pos`
- [ ] **(Eduardo)** Crear proyecto nuevo en Supabase para pruebas

## 2. Base de datos instalable
- [ ] Sacar de Tres Encantos un solo SQL con toda la estructura (sin datos)
- [ ] Datos iniciales: categorías genéricas, configuración por defecto
- [ ] Probarlo en el proyecto nuevo y crear la primera cuenta (dueña)
- [ ] Desplegar las Edge Functions (`create-user`, `groq-proxy`, `drive-proxy`)
- [ ] **(Eduardo)** Apps Script de Drive para el negocio de prueba
- [ ] Control de versiones de la base (qué cambios tiene cada negocio)

## 3. Quitar lo que es solo de Tres Encantos
- [ ] Tienda: nombre, logo, portada, "Nosotros", WhatsApp, redes, dirección → configurables
- [ ] Quitar foto/historia de Ofelia, Facebook, Maquixco, textos de Natura en `index.html`
- [ ] "Ya lo cobró Ofelia" → "Ya lo cobró [dueña]" configurable (`pos-core.js`)
- [ ] Correos y horarios fijos en `activity.js`
- [ ] Natura/Avon/revista → opcional ("marca por catálogo")
- [ ] `manifest.json`, íconos, títulos de páginas, `og:*`
- [ ] `MANUAL.md` genérico
- [ ] Scripts: respaldo y pruebas sin cuentas/nombres de Tres Encantos
- [ ] Reescribir `CLAUDE.md` para Sunny POS

## 4. Módulos que se prenden y apagan
- [ ] Lista de módulos en `negocio.js` / `config`: Tienda, Libreta, Fiado, Recepción con IA, Marca por catálogo
- [ ] Tienda apagada: sin ícono, la dirección principal lleva al inicio de sesión, sin "Publicar en web"

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
