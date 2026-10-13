"""Mide cuánto tarda cada pantalla en mostrar contenido real y cuánto descarga.

Uso:  AUDITOR_PWD=... python scripts/medir_rapidez.py [etiqueta]
Requiere el servidor local (python -m http.server 8080) y Playwright.
Simula un celular con 4G (9 Mbps / 60 ms). Corre cada pantalla 2 veces y
reporta la mejor (la primera calienta el caché del navegador para las librerías
CDN, como pasaría en el día a día). Guarda el resultado en
scripts/rapidez/<etiqueta>.json para comparar antes/después.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8080/'
ETIQ = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d_%H%M')
RED_4G = {'offline': False, 'latency': 60, 'downloadThroughput': 9e6 / 8, 'uploadThroughput': 3e6 / 8}

# Cuándo una pantalla "ya sirve": condición en la página
LISTO = {
    'Inventario': ('admin.html', "document.querySelectorAll('#products-table tr[data-id], #products-card-grid .admin-card[data-id], #products-table .mpc-row:not(.sk-row)').length >= 10"),
    'Caja':       ('pos.html',   "document.querySelectorAll('#pos-results [onclick]').length >= 10"),
    'Reportes':   ('stats.html', "(() => { const v = document.getElementById('kpi-revenue')?.textContent || ''; return /\\$\\s?[0-9]/.test(v); })()"),
    'Actividad':  ('activity.html', "document.querySelectorAll('.act-item, .act-card, [class*=act-row]').length >= 5"),
    'Tienda':     ('index.html', "document.querySelectorAll('#products-grid .product-card:not(.skel-card)').length >= 8"),
}

def medir(ctx, url, cond):
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions', RED_4G)
    bytes_ = {'n': 0, 'api': 0}
    def fin(ev):
        bytes_['n'] += ev.get('encodedDataLength', 0)
    cdp.on('Network.loadingFinished', fin)
    api = []
    pg.on('response', lambda r: api.append(r.url) if '/rest/v1/' in r.url else None)
    t0 = time.time()
    pg.goto(BASE + url, wait_until='commit')
    try:
        pg.wait_for_function(cond, timeout=120000, polling=100)
        t = time.time() - t0
    except Exception:
        t = None
    pg.wait_for_timeout(1500)
    r = {'segundos': round(t, 2) if t else None, 'MB': round(bytes_['n'] / 1048576, 2), 'consultas': len(api)}
    pg.close()
    return r

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(BASE + 'admin.html'); pg.wait_for_selector('#email-input')
    pg.fill('#email-input', 'auditor@gmail.com'); pg.fill('#pwd-input', os.environ['AUDITOR_PWD']); pg.press('#pwd-input', 'Enter')
    pg.wait_for_function("!!localStorage.getItem('te_admin_session')", timeout=30000); pg.wait_for_timeout(3000)
    pg.close()
    res = {}
    for nombre, (url, cond) in LISTO.items():
        corridas = [medir(ctx, url, cond) for _ in range(2)]
        ok = [c for c in corridas if c['segundos']]
        mejor = min(ok, key=lambda c: c['segundos']) if ok else corridas[-1]
        res[nombre] = mejor
        print(f"{nombre:11s} {str(mejor['segundos'] or 'NO CARGÓ'):>8} s   {mejor['MB']:6.2f} MB   {mejor['consultas']:3d} consultas")
    b.close()
os.makedirs(os.path.join(os.path.dirname(__file__), 'rapidez'), exist_ok=True)
json.dump(res, open(os.path.join(os.path.dirname(__file__), 'rapidez', f'{ETIQ}.json'), 'w'), indent=1)
