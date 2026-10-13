/* Configuración de este negocio — el ÚNICO archivo que cambia entre clientes.
   Todo lo demás (Caja, Inventario, Reportes, Tienda…) es igual para todos.
   Se carga antes que cualquier otro script en cada página. */
window.NEGOCIO = {
  nombre: 'Sunny POS',

  // Supabase de ESTE negocio (Dashboard → Project Settings → API).
  // La anon key es pública por diseño; la service_role key NUNCA va aquí.
  supabaseUrl: 'https://aduahsqbmborplojhubw.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWFoc3FibWJvcnBsb2podWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDA0ODMsImV4cCI6MjEwNzQ3NjQ4M30._q99xYihkZ9so8Yh3NaabTllvU20AoqMATVV9ktVvw4',

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
