"""Revisión automática del JavaScript (correr antes de publicar).

Uso:  python scripts/revisar_codigo.py
Necesita Node (usa ESLint por npx, sin instalar nada en el repo).

Este proyecto no tiene bundler: cada página carga varios <script> que
comparten el ámbito global (admin.html carga 16). Por eso, por página:
  1. Lee sus <script src> en orden y junta lo que cada uno declara arriba
     (function, const, let, var, class, window.x =).
  2. Avisa si dos scripts declaran el mismo const/let/class: el navegador
     rechaza el segundo archivo COMPLETO ("Identifier has already been declared").
  3. Corre ESLint en cada script con esos nombres como globales: atrapa
     llamadas a funciones/variables que no existen (el ReferenceError que
     deja una pantalla en "Cargando…"), llaves duplicadas, código inalcanzable…
Sale con código 1 si hay errores.
"""
import json, os, re, subprocess, sys, tempfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ESLINT = 'eslint@9.13.0'
PAGINAS = ['index.html', 'admin.html', 'pos.html', 'stats.html', 'activity.html', 'settings.html']
# Librerías que se cargan por CDN al necesitarse, y globales del navegador que ESLint no trae
EXTERNOS = ['XLSX', 'JsBarcode', 'Chart', 'Html5Qrcode', 'Html5QrcodeSupportedFormats', 'Quagga', 'supabase',
            'NEGOCIO', 'TE', 'gtag', 'dataLayer']
sys.stdout.reconfigure(encoding='utf-8')

DECL = re.compile(r'^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(const|let|var|class)\s+([A-Za-z_$][\w$]*)', re.M)
DESTR = re.compile(r'^(?:const|let|var)\s+[{\[]([^}\]=]*)[}\]]\s*=', re.M)
WINDOW = re.compile(r'\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)')

def scripts_de(pagina):
    html = open(os.path.join(RAIZ, pagina), encoding='utf-8').read()
    return [s for s in re.findall(r'<script[^>]+src="([^"]+)"', html) if not s.startswith('http')]

def declaraciones(archivo):
    src = open(os.path.join(RAIZ, archivo), encoding='utf-8').read()
    nombres, bloque = {}, set()
    for m in DECL.finditer(src):
        if m.group(1): nombres[m.group(1)] = 'function'
        else:
            nombres[m.group(3)] = m.group(2)
            if m.group(2) in ('const', 'let', 'class'): bloque.add(m.group(3))
    for m in DESTR.finditer(src):
        for n in re.findall(r'([A-Za-z_$][\w$]*)\s*(?:,|$|:)', m.group(1)):
            nombres.setdefault(n, 'const')
    for n in WINDOW.findall(src): nombres.setdefault(n, 'window')
    return nombres, bloque

def eslint(archivos, globales):
    reglas = {r: 'error' for r in ('no-undef', 'no-dupe-keys', 'no-unreachable', 'no-self-assign', 'no-dupe-else-if',
              'no-duplicate-case', 'no-func-assign', 'no-const-assign', 'use-isnan', 'valid-typeof',
              'no-unsafe-negation', 'no-compare-neg-zero', 'no-sparse-arrays', 'no-dupe-args')}
    reglas['no-cond-assign'] = ['error', 'except-parens']
    conf = [{'languageOptions': {'ecmaVersion': 2023, 'sourceType': 'script',
                                 'globals': {**NAVEGADOR, **{g: 'readonly' for g in globales}}},
             'linterOptions': {'reportUnusedDisableDirectives': 'off'}, 'rules': reglas}]
    fd, ruta = tempfile.mkstemp(suffix='.mjs', dir=RAIZ, prefix='.eslint-tmp-')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write('export default ' + json.dumps(conf) + ';\n')
    try:
        r = subprocess.run(f'npx --yes {ESLINT} --no-config-lookup -c "{ruta}" -f json ' + ' '.join(f'"{a}"' for a in archivos),
                           cwd=RAIZ, capture_output=True, text=True, encoding='utf-8', shell=True)
    finally:
        os.remove(ruta)
    try: return json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit('No se pudo correr ESLint:\n' + (r.stderr or r.stdout)[:1500])

# Globales del navegador (lo que usa la app; ESLint sin el paquete "globals" no los conoce)
NAVEGADOR = {n: 'readonly' for n in '''window document navigator location localStorage sessionStorage console fetch
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame alert confirm prompt
URL URLSearchParams Blob File FileReader FormData Image Event CustomEvent KeyboardEvent MouseEvent
HTMLElement HTMLInputElement Element Node NodeList DOMParser MutationObserver IntersectionObserver ResizeObserver
AbortController TextDecoder TextEncoder crypto atob btoa performance history screen matchMedia getComputedStyle
indexedDB IDBKeyRange Notification caches self Intl Promise Map Set WeakMap JSON Math Date Number String Array
Object Symbol RegExp Error TypeError structuredClone queueMicrotask innerWidth innerHeight scrollX scrollY
scrollTo devicePixelRatio open print close addEventListener removeEventListener dispatchEvent CSS
speechSynthesis SpeechRecognition webkitSpeechRecognition BarcodeDetector Response Request Headers
visualViewport getSelection Audio AudioContext webkitAudioContext ImageData OffscreenCanvas createImageBitmap
HTMLCanvasElement HTMLImageElement ClipboardItem PointerEvent TouchEvent InputEvent DragEvent ErrorEvent
PromiseRejectionEvent BroadcastChannel ServiceWorkerRegistration clients registration skipWaiting'''.split()}

def main():
    errores = 0
    for pagina in PAGINAS:
        archivos = scripts_de(pagina)
        globales, quien = set(EXTERNOS), {}
        for a in archivos:
            nombres, bloque = declaraciones(a)
            for n in bloque:
                if n in quien and quien[n] != a:
                    print(f'✗ {pagina}: "{n}" se declara en {quien[n]} y otra vez en {a} (el navegador rechaza {a} completo)')
                    errores += 1
                quien.setdefault(n, a)
            globales |= set(nombres)
    # Un archivo que se carga en varias páginas (shared.js) se revisa con lo de
    # TODAS: ahí cada llamada a algo de un módulo va con typeof (p. ej.
    # typeof toast === 'function'). Aun así atrapa lo que no existe en ninguna.
    comunes = {}
    for pagina in PAGINAS:
        archivos = scripts_de(pagina)
        g = set(EXTERNOS)
        for a in archivos: g |= set(declaraciones(a)[0])
        for a in archivos: comunes[a] = g if a not in comunes else comunes[a] | g
    grupos = {}
    for a, g in comunes.items(): grupos.setdefault(frozenset(g), []).append(a)
    for g, archivos in grupos.items():
        for res in eslint(archivos, sorted(g)):
            for m in res['messages']:
                if m.get('severity', 0) < 2: continue
                print(f"✗ {os.path.relpath(res['filePath'], RAIZ)}:{m.get('line')}  {m['message']}  [{m.get('ruleId')}]")
                errores += 1
    total = len(comunes)
    print(f'\n{total} archivos JS revisados en {len(PAGINAS)} páginas: ' + ('sin errores ✓' if not errores else f'{errores} error(es)'))
    sys.exit(1 if errores else 0)

if __name__ == '__main__':
    main()
