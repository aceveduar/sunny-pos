"""Prueba de humo: abre los 6 módulos (celular y escritorio) y avisa de cualquier
error de JavaScript. Correr antes de publicar cambios de pantalla.

Necesita el servidor local y la cuenta de pruebas (la contraseña NO se guarda):
    python -m http.server 8080 --bind 127.0.0.1
    set AUDITOR_PWD=...   (PowerShell: $env:AUDITOR_PWD='...')
    python scripts/pruebas/humo.py
Sale con código 1 si hubo errores.
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SUNNY_URL', 'http://localhost:8080/')
CUENTA = os.environ.get('AUDITOR_EMAIL', 'auditor@gmail.com')
PWD = os.environ.get('AUDITOR_PWD')
if not PWD:
    sys.exit('Falta AUDITOR_PWD (contraseña de la cuenta de pruebas)')

total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for nombre, vp, movil in (('celular', {'width': 390, 'height': 844}, True), ('escritorio', {'width': 1366, 'height': 900}, False)):
        ctx = b.new_context(viewport=vp, service_workers='block', is_mobile=movil, has_touch=movil)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append((pg.url.split('/')[-1], str(e)[:200])))
        pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text
              and errs.append((pg.url.split('/')[-1], 'consola: ' + m.text[:200])))
        pg.goto(BASE + 'admin.html'); pg.wait_for_selector('#email-input')
        pg.fill('#email-input', CUENTA); pg.fill('#pwd-input', PWD); pg.press('#pwd-input', 'Enter')
        pg.wait_for_function("document.getElementById('prod-count')?.textContent.includes('productos')", timeout=60000)
        pg.wait_for_timeout(3000)
        pg.evaluate("products[0] && openQV(products[0].id)"); pg.wait_for_timeout(800); pg.evaluate("closeQV()")
        for page in ('pos.html', 'stats.html', 'activity.html', 'settings.html', 'index.html'):
            pg.goto(BASE + page); pg.wait_for_timeout(7000)
            if page == 'stats.html':
                for m in ('week', 'month'):
                    pg.evaluate(f"setMode('{m}')"); pg.wait_for_timeout(3000)
            if page == 'settings.html':
                for h in ('#usuarios', '#catalogo', '#datos', '#integraciones', '#avisos'):
                    pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_timeout(1200)
        print(f'{nombre}: ' + ('sin errores' if not errs else f'{len(errs)} error(es)'))
        for pagina, e in errs: print(f'  {pagina}: {e}')
        total += len(errs)
        ctx.close()
    b.close()
sys.exit(1 if total else 0)
