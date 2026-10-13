"""Reemplaza valores de diseño sueltos por las variables de tema.css.

Uso: python scripts/tokenizar_css.py [--dry]
Se puede volver a correr: solo toca lo que todavía esté escrito a mano.
Aplica a *.css (menos tema.css) y a los style="..." de *.html y *.js.
"""
import re, glob, sys

DRY = '--dry' in sys.argv

COLOR = {
    # rojo
    'E85D5D': 'var(--red)',
    'FEF2F2': 'var(--tint-red-bg)', 'FEE2E2': 'var(--tint-red-bg)', 'FFF3F3': 'var(--tint-red-bg)', 'FFF5F5': 'var(--tint-red-bg)',
    'FECACA': 'var(--tint-red-border)', 'FCA5A5': 'var(--tint-red-border)',
    'B91C1C': 'var(--tint-red-strong)', '991B1B': 'var(--tint-red-strong)', 'C62828': 'var(--tint-red-strong)', 'DC2626': 'var(--tint-red-strong)', 'C0392B': 'var(--tint-red-strong)',
    # ámbar
    'FFFBEB': 'var(--tint-amber-bg)', 'FEF3C7': 'var(--tint-amber-bg)', 'FEF3CD': 'var(--tint-amber-bg)', 'FFF8E7': 'var(--tint-amber-bg)',
    'FDE68A': 'var(--tint-amber-border)', 'FCD34D': 'var(--tint-amber-border)',
    '92400E': 'var(--tint-amber-strong)', 'B45309': 'var(--tint-amber-strong)', '78350F': 'var(--tint-amber-strong)', 'D97706': 'var(--tint-amber-strong)',
    'F59E0B': 'var(--amber)',
    # verde
    'ECFDF5': 'var(--tint-green-bg)', 'D1FAE5': 'var(--tint-green-bg)', 'F0FDF4': 'var(--tint-green-bg)',
    '6EE7B7': 'var(--tint-green-border)', 'A7F3D0': 'var(--tint-green-border)', 'BBF7D0': 'var(--tint-green-border)',
    '065F46': 'var(--tint-green-strong)', '047857': 'var(--tint-green-strong)', '166534': 'var(--tint-green-strong)',
    '2D6A4F': 'var(--green)',
    # azul / violeta
    'EFF6FF': 'var(--tint-blue-bg)', 'DBEAFE': 'var(--tint-blue-bg)', 'BFDBFE': 'var(--tint-blue-border)',
    '1D4ED8': 'var(--tint-blue-strong)', '1E40AF': 'var(--tint-blue-strong)', '2563EB': 'var(--tint-blue-strong)',
    'F5F3FF': 'var(--tint-violet-bg)', 'EDE9FE': 'var(--tint-violet-bg)', 'DDD6FE': 'var(--tint-violet-border)',
    '6D28D9': 'var(--tint-violet-strong)', '7C3AED': 'var(--tint-violet-strong)', '7C5CBF': 'var(--violet)',
    # neutros
    'EAE0D4': 'var(--border)', 'E8DDD0': 'var(--border)', 'F0E8DF': 'var(--border-light)',
    '8A7564': 'var(--muted)', '9B8B78': 'var(--muted)', 'B5A696': 'var(--muted-light)',
    'F8F4EF': 'var(--surface-soft)', 'F5EDE4': 'var(--surface-soft)',
    'FAF5EE': 'var(--cream)', 'F7F2EB': 'var(--cream)',
}

def radio(v):
    v = v.strip()
    m = re.fullmatch(r'(\d+(?:\.\d+)?)px', v)
    if not m: return None
    n = float(m.group(1))
    if n <= 3: return None                      # líneas y barras finas: se quedan
    if n >= 40: return 'var(--radio-pill)'      # 50px, 99px, 999px
    for lim, tok in ((6, 'xs'), (10, 'sm'), (14, 'md'), (18, 'lg'), (30, 'xl')):
        if n < lim: return f'var(--radio-{tok})'
    return None

def fix_radius(m):
    prop, val, imp = m.group(1), m.group(2), m.group(3) or ''
    parts = val.split()
    out = []
    for p in parts:
        r = radio(p)
        out.append(r if r else p)
    return f'{prop}{" ".join(out)}{imp}'

SHADOW_SIMPLE = re.compile(r'^0 (\d+)px (\d+)px rgba\((?:28,\s*24,\s*23|0,\s*0,\s*0),\s*(?:0)?\.(\d+)\)$')
def fix_shadow(m):
    prop, val, imp = m.group(1), m.group(2).strip(), m.group(3) or ''
    s = SHADOW_SIMPLE.match(val)
    if not s: return m.group(0)
    blur = int(s.group(2))
    tok = 'var(--sombra-1)' if blur <= 6 else 'var(--sombra-2)' if blur <= 24 else 'var(--sombra-3)'
    return f'{prop}{tok}{imp}'

def fix_colors(text):
    def rep(m):
        h = m.group(1).upper()
        if len(h) == 3: return m.group(0)
        return COLOR.get(h, m.group(0))
    return re.sub(r'(?<![\w-])#([0-9a-fA-F]{6})\b', rep, text)

def transform_decls(text):
    text = re.sub(r'(border(?:-(?:top|bottom)-(?:left|right))?-radius:\s*)([^;{}!"]+?)(\s*!important)?(?=[;}"])', fix_radius, text)
    text = re.sub(r'(box-shadow:\s*)([^;{}!"]+?)(\s*!important)?(?=[;}"])', fix_shadow, text)
    return fix_colors(text)

def css_file(src):
    # No tocar bloques :root (definiciones), url(data:...) ni comentarios
    out, i = [], 0
    for m in re.finditer(r'/\*.*?\*/|url\([^)]*\)|:root(?:\[[^\]]*\])?\s*\{[^}]*\}', src, re.S):
        out.append(transform_decls(src[i:m.start()])); out.append(m.group(0)); i = m.end()
    out.append(transform_decls(src[i:]))
    return ''.join(out)

def inline_styles(src):
    return re.sub(r'style="([^"]*)"', lambda m: 'style="' + transform_decls(m.group(1) + ';')[:-1] + '"', src)

total = 0
for f in sorted(glob.glob('*.css')):
    if f == 'tema.css': continue
    s = open(f, encoding='utf-8').read(); n = css_file(s)
    if n != s:
        c = sum(1 for a, b in zip(s.splitlines(), n.splitlines()) if a != b); total += c
        print(f'{f}: {c} líneas'); DRY or open(f, 'w', encoding='utf-8', newline='\n').write(n)
for f in sorted(glob.glob('*.html') + glob.glob('*.js')):
    if f in ('negocio.js', 'sw.js'): continue
    s = open(f, encoding='utf-8').read(); n = inline_styles(s)
    if n != s:
        c = sum(1 for a, b in zip(s.splitlines(), n.splitlines()) if a != b); total += c
        print(f'{f}: {c} líneas (estilos en línea)'); DRY or open(f, 'w', encoding='utf-8', newline='\n').write(n)
print('total', total, '(simulación)' if DRY else '')
