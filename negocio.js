/* Configuración de este negocio — el ÚNICO archivo que cambia entre clientes.
   Todo lo demás (Caja, Inventario, Reportes, Tienda…) es igual para todos.
   Se carga en <head>, después de las hojas de estilo y antes que cualquier otro script. */
window.NEGOCIO = {
  nombre: 'Sunny POS',

  // Supabase de ESTE negocio (Dashboard → Project Settings → API).
  // La anon key es pública por diseño; la service_role key NUNCA va aquí.
  supabaseUrl: 'https://aduahsqbmborplojhubw.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWFoc3FibWJvcnBsb2podWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDA0ODMsImV4cCI6MjEwNzQ3NjQ4M30._q99xYihkZ9so8Yh3NaabTllvU20AoqMATVV9ktVvw4',

  // WhatsApp del negocio, 10 dígitos (México). Recibe los pedidos de la Tienda
  // y el "Resumen del día" de Reportes.
  whatsapp: '',

  // Dueña: Caja muestra "Ya lo cobró <nombre>" para los cobros que ella hace
  // fuera de la tienda (no cuentan en el cajón de quien captura). Debe ser una
  // cuenta con rol de dueña/superadmin. Vacío = no se muestra el botón.
  duena: { nombre: '', correo: '' },

  // Módulos de este negocio (plan contratado). false = apagado:
  //  tienda: sin Tienda en línea — la dirección principal lleva al inicio de
  //          sesión y se esconden Publicar/Ocultar, Compartir y el ícono Tienda.
  //  fiado:  sin "Se lo lleva hoy" en los apartados.
  modulos: { tienda: true, fiado: true },

  // Formas de pago que aparecen en Caja. Quitar 'tarjeta' si el negocio no
  // tiene terminal (así nadie la toca por error y descuadra el corte).
  formasDePago: ['efectivo', 'transferencia', 'tarjeta'],

  // Google Analytics de la Tienda (G-XXXXXXX). Vacío = sin Analytics.
  analyticsId: '',

  // Logo (ruta o URL de imagen). Vacío = se muestra el nombre en letra elegante.
  logo: '',

  // ── Tienda en línea ────────────────────────────────────────────────
  // Todo es opcional: lo que se deja vacío se oculta solo.
  // *palabra* entre asteriscos se pinta en cursiva con el color de marca.
  tienda: {
    titulo: 'Lo que te gusta,\n*a un mensaje* de distancia.',
    descripcion: 'Ropa, bolsos, accesorios y belleza — pídelo por WhatsApp.',
    zona: 'Envíos a domicilio',            // etiqueta pequeña sobre el título
    acerca: 'Tu boutique de ropa, accesorios y belleza.',  // pie de página y buscadores

    // Sección "Nosotros" (sin texto = no se muestra)
    nosotros: {
      titulo: '',                          // ej. 'Una tienda hecha\n*con cariño*'
      parrafos: [],                        // ej. ['Somos…', 'Empezamos…']
      foto: '',                            // ruta o URL
    },

    // Local y entregas (sin dirección = no se muestra la tarjeta del local)
    direccion: { calle: '', referencia: '', colonia: '', ciudad: '', mapa: '' },
    entregas: 'Llevamos tu pedido a domicilio. Escríbenos para coordinar la entrega.',

    redes: { facebook: '', instagram: '', tiktok: '' },

    // Marca que se vende por catálogo (Natura, Avon, Jafra…). Vacío = sin sección.
    catalogo: {
      marca: '',                           // ej. 'Natura'
      categoria: '',                       // código de categoría de sus productos
      titulo: '',                          // ej. 'La belleza\n*que cuida*'
      texto: '',
    },
  },

  // Color de marca (botones, pestaña activa, precios destacados, gráficas).
  // Cualquier tono sirve: los tonos derivados y el color del texto encima
  // (blanco o casi negro, el que se lea mejor) se calculan solos.
  color: '#4F7461',
};

// Título de la pestaña: "Caja — <nombre del negocio>"
if (window.NEGOCIO.nombre && document.title && !document.title.includes(window.NEGOCIO.nombre)) {
  document.title = document.title + ' — ' + window.NEGOCIO.nombre;
}

// Tema: aplica el color de marca antes de pintar (este archivo va en <head>,
// después de las hojas de estilo). Los valores por defecto viven en shared.css
// y style.css; aquí solo se sobrescriben con los de este negocio.
(function aplicarColorDeMarca() {
  // Probar otro color sin tocar este archivo: agregar ?color=4F7461 a la dirección.
  // Se recuerda mientras la pestaña siga abierta; ?color=0 vuelve al de aquí.
  let prueba = null;
  try {
    const q = new URLSearchParams(location.search).get('color');
    if (q === '0') sessionStorage.removeItem('negocio_color_prueba');
    else if (q && /^#?[0-9a-f]{6}$/i.test(q)) sessionStorage.setItem('negocio_color_prueba', '#' + q.replace('#', ''));
    prueba = sessionStorage.getItem('negocio_color_prueba');
  } catch {}
  const hex = String(prueba || window.NEGOCIO.color || '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lum = c => {
    const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const WHITE = [255, 255, 255], INK = [31, 27, 22], DARK_BG = [20, 18, 16];
  // Texto de marca legible (4.5:1) sobre blanco y, en oscuro, sobre el fondo oscuro
  let dark = rgb; for (let t = 0; contrast(dark, WHITE) < 4.5 && t < 1; t += .05) dark = mix(rgb, [0, 0, 0], t);
  let light = rgb; for (let t = 0; contrast(light, DARK_BG) < 4.5 && t < 1; t += .05) light = mix(rgb, WHITE, t);
  let claro = rgb; for (let t = 0; contrast(claro, DARK_BG) < 7 && t < 1; t += .05) claro = mix(rgb, WHITE, t);
  const onBrand = contrast(rgb, WHITE) >= 3 ? '#fff' : toHex(INK);
  const css =
    `:root{--brand:${hex};--brand-rgb:${rgb.join(',')};--brand-dark:${toHex(dark)};` +
    `--brand-light:${toHex(mix(rgb, WHITE, .88))};--on-brand:${onBrand};--brand-claro:${toHex(claro)}}` +
    `:root[data-theme="dark"]{--brand-dark:${toHex(light)};--brand-light:${toHex(mix(DARK_BG, rgb, .18))}}`;
  const style = document.createElement('style');
  style.id = 'negocio-color';
  style.textContent = css;
  document.head.appendChild(style);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', hex);
})();

// Sin Supabase configurado la app no puede funcionar: avisarlo claro en vez
// de dejar pantallas en "Cargando…" (y nunca apuntar por error a otra base).
if (!window.NEGOCIO.supabaseUrl || !window.NEGOCIO.supabaseAnonKey) {
  document.addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#fff;color:#222;font:16px/1.5 system-ui,sans-serif;text-align:center';
    d.innerHTML = '<div><strong>Falta configurar este negocio.</strong><br>Escribe la dirección y la llave de Supabase en <code>negocio.js</code>.</div>';
    document.body.appendChild(d);
  });
}

// Logo del negocio en cualquier página: <span data-negocio-logo></span> se
// vuelve la imagen de NEGOCIO.logo o, si no hay, el nombre en letra elegante.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-negocio-logo]').forEach(el => {
    const n = window.NEGOCIO;
    el.textContent = '';
    if (n.logo) {
      const img = document.createElement('img');
      img.src = n.logo; img.alt = n.nombre || '';
      el.appendChild(img);
    } else {
      const t = document.createElement('span');
      t.className = 'negocio-logo-texto';
      t.textContent = n.nombre || '';
      el.appendChild(t);
    }
  });
});

// Módulos apagados: clase en <html> (shared.css esconde lo que sobra) y, sin
// Tienda, la página de la Tienda manda al inicio de sesión.
(function () {
  const m = window.NEGOCIO.modulos || {};
  const raiz = document.documentElement;
  if (m.tienda === false) {
    raiz.classList.add('sin-tienda');
    if (/(^|\/)(index\.html)?$/.test(location.pathname)) location.replace('admin.html');
  }
  if (m.fiado === false) raiz.classList.add('sin-fiado');
})();
