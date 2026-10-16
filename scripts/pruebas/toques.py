"""Auditoría de áreas de toque en celular (regla del proyecto: mínimo 44 px).

Uso (servidor local corriendo y AUDITOR_PWD en el entorno):
    python scripts/pruebas/toques.py
Abre cada pantalla a 390 px y lista lo que se puede tocar (botones, enlaces,
campos, [onclick]) que mide menos de 44 px de alto o de ancho, salvo que tenga
área de toque extendida con ::after (position:absolute; inset negativo).
Agrupa por clase para ver qué componente corregir. Sale con 1 si hay alguno.
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SUNNY_URL', 'http://localhost:8080/')
PWD = os.environ.get('AUDITOR_PWD') or sys.exit('Falta AUDITOR_PWD')
sys.stdout.reconfigure(encoding='utf-8')

MEDIR = r"""() => {
  const MIN = 44, fuera = [];
  // Visible de verdad: ni ella ni sus contenedores transparentes, ocultos o sin toques
  // (las ventanas cerradas de este proyecto se esconden con opacity/pointer-events)
  const vis = el => { const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight * 3 && r.right > 0 && r.left < innerWidth)) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || cs.pointerEvents === 'none') return false;
    }
    return true; };
  // Área extendida con ::after: cuánto crece hacia los lados (x) y arriba/abajo (y)
  const slop = el => { const a = getComputedStyle(el, '::after');
    if (a.content === 'none' || a.position !== 'absolute') return { x: 0, y: 0 };
    return { x: Math.max(0, -parseFloat(a.left) || 0), y: Math.max(0, -parseFloat(a.top) || 0) }; };
  document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [onclick], [role=button]').forEach(el => {
    if (!vis(el) || el.closest('[aria-hidden=true]') || el.disabled) return;
    // Excepción: puntitos de la galería (se navega deslizando; son solo indicador)
    if (el.classList.contains('qv-gd')) return;
    // Excepción de ancho: flechas de reordenar fotos (dos por miniatura); el alto sí se exige
    if (el.classList.contains('ai-mov') && el.getBoundingClientRect().height + 14 >= MIN) return;
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) return;
    const r = el.getBoundingClientRect(), s = slop(el);
    const w = r.width + 2 * s.x, h = r.height + 2 * s.y;
    if (w < MIN || h < MIN) fuera.push({ cls: (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      tag: el.tagName.toLowerCase(), txt: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(w), h: Math.round(h) });
  });
  return fuera;
}"""

PANTALLAS = [
    ('Inventario', 'admin.html', None),
    ('Inventario · ficha', 'admin.html', "openQV(products[0].id)"),
    ('Inventario · formulario', 'admin.html', "openForm(products[0].id)"),
    ('Caja', 'pos.html', None),
    ('Caja · apartados', 'pos.html', "openApartados()"),
    ('Reportes', 'stats.html', None),
    ('Actividad', 'activity.html', None),
    ('Configuración', 'settings.html', None),
    ('Tienda', 'index.html', None),
]

total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(BASE + 'admin.html'); pg.wait_for_selector('#email-input')
    pg.fill('#email-input', os.environ.get('AUDITOR_EMAIL', 'auditor@gmail.com')); pg.fill('#pwd-input', PWD); pg.press('#pwd-input', 'Enter')
    pg.wait_for_function("document.getElementById('prod-count')?.textContent.includes('productos')", timeout=60000)
    for nombre, url, accion in PANTALLAS:
        pg.goto(BASE + url); pg.wait_for_timeout(6000)
        if accion: pg.evaluate(accion); pg.wait_for_timeout(1500)
        res = pg.evaluate(MEDIR)
        grupos = {}
        for e in res: grupos.setdefault(e['cls'] or e['tag'], []).append(e)
        total += len(res)
        print(f'\n{nombre}: ' + ('todo ≥44 px ✓' if not res else f'{len(res)} chicos'))
        for k, es in sorted(grupos.items(), key=lambda x: -len(x[1]))[:12]:
            e = es[0]
            print(f'   {len(es):>3}× {k[:48]:<48} {e["w"]}×{e["h"]}  «{e["txt"]}»')
    b.close()
sys.exit(1 if total else 0)
