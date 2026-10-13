/* Configuración de este negocio — el ÚNICO archivo que cambia entre clientes.
   Todo lo demás (Caja, Inventario, Reportes, Tienda…) es igual para todos.
   Se carga antes que cualquier otro script en cada página. */
window.NEGOCIO = {
  nombre: 'Sunname Mostrador',

  // Supabase de ESTE negocio (Dashboard → Project Settings → API).
  // La anon key es pública por diseño; la service_role key NUNCA va aquí.
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Google Analytics de la Tienda (G-XXXXXXX). Vacío = sin Analytics.
  analyticsId: '',
};

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
