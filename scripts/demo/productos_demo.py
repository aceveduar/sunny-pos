"""Carga productos de prueba con foto en Sunny POS Pruebas.

Fotos: catálogo público de dummyjson.com (solo para pruebas; se enlazan, no se copian).
Nombres, precios y descripciones se generan en español. Todos llevan created_by = 'demo',
así se borran con:  python scripts/demo/productos_demo.py --borrar

Uso: python scripts/demo/productos_demo.py [cantidad]   (default 1000)
"""
import json, os, random, subprocess, sys, tempfile, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SQL = os.path.join(HERE, '..', 'instalar', 'sql.py')

def run_sql(sql):
    fd, tmp = tempfile.mkstemp(suffix='.sql')
    with os.fdopen(fd, 'w', encoding='utf-8') as f: f.write(sql)
    r = subprocess.run([sys.executable, SQL, tmp], capture_output=True, text=True, encoding='utf-8')
    print((r.stdout + r.stderr).strip()[:500])
    try: os.remove(tmp)
    except OSError: pass
    if r.returncode: sys.exit(1)

if '--borrar' in sys.argv:
    run_sql("DELETE FROM public.recently_edited WHERE product_id IN (SELECT id FROM public.products WHERE created_by = 'demo');"
            "DELETE FROM public.product_changes WHERE product_id IN (SELECT id FROM public.products WHERE created_by = 'demo');"
            "DELETE FROM public.products WHERE created_by = 'demo' "
            "AND NOT EXISTS (SELECT 1 FROM public.sales s, jsonb_array_elements(s.items) i WHERE (i->>'id')::bigint = products.id);"
            "SELECT count(*) AS quedan_demo FROM public.products WHERE created_by = 'demo';")
    sys.exit()

N = int(next((a for a in sys.argv[1:] if a.isdigit()), 1000))
random.seed(7)

# dummyjson → (código, etiqueta, sustantivos en español)
MAPA = {
    'womens-bags':      [('bolsos', 'Bolsos', ['Bolso de mano', 'Bolso tote', 'Bolso cruzado', 'Bolso de hombro']),
                         ('carteras', 'Carteras', ['Cartera', 'Cartera larga', 'Monedero']),
                         ('mochilas', 'Mochilas', ['Mochila', 'Mochila mini'])],
    'womens-jewellery': [('joyeria', 'Joyería', ['Collar', 'Aretes', 'Pulsera', 'Anillo', 'Dije'])],
    'womens-shoes':     [('calzado', 'Calzado', ['Zapatilla', 'Sandalia', 'Tenis', 'Botín', 'Flats'])],
    'beauty':           [('maquillaje', 'Maquillaje', ['Labial', 'Rímel', 'Sombras', 'Base líquida', 'Delineador', 'Rubor'])],
    'skin-care':        [('cuidado_personal', 'Cuidado personal', ['Crema facial', 'Sérum', 'Loción corporal', 'Protector solar'])],
    'fragrances':       [('perfumes', 'Perfumes', ['Perfume', 'Eau de toilette', 'Body mist'])],
    'sunglasses':       [('lentes', 'Lentes', ['Lentes de sol', 'Lentes de sol polarizados'])],
    'tops':             [('blusas', 'Blusas', ['Blusa', 'Top', 'Playera', 'Blusa de manga larga'])],
    'womens-dresses':   [('vestidos', 'Vestidos', ['Vestido', 'Vestido largo', 'Vestido casual'])],
    'womens-watches':   [('accesorios', 'Accesorios', ['Reloj', 'Reloj de pulso'])],
    'home-decoration':  [('regalos', 'Regalos', ['Vela aromática', 'Portarretrato', 'Florero', 'Caja de regalo'])],
}
COLORES = ['negro', 'blanco', 'beige', 'rosa palo', 'azul marino', 'rojo', 'café', 'dorado', 'plateado',
           'verde olivo', 'nude', 'lila', 'vino', 'camel', 'gris']
DETALLES = ['clásico', 'de temporada', 'edición especial', 'básico', 'premium', 'mini', 'grande', 'con brillo',
            'mate', 'vintage', 'casual', 'elegante']
TALLAS = ['CH', 'M', 'G', 'EG']
NUMEROS = ['22', '23', '24', '25', '26']
ML = ['30 ml', '50 ml', '100 ml']
DESC = {
    'bolsos': 'Amplio, ligero y con cierre seguro. Combina con todo, de día o de noche.',
    'carteras': 'Compartimentos para tarjetas, billetes y monedas. Acabado resistente.',
    'mochilas': 'Cómoda para el diario, con bolsillos interiores y correas ajustables.',
    'joyeria': 'Acabado que no se oscurece. Ideal para regalo.',
    'calzado': 'Plantilla acolchada para usar todo el día.',
    'maquillaje': 'Larga duración y color intenso. Fórmula ligera.',
    'cuidado_personal': 'Hidrata y cuida tu piel. Para uso diario.',
    'perfumes': 'Aroma fresco y duradero.',
    'lentes': 'Protección UV400. Incluye estuche.',
    'blusas': 'Tela suave y fresca. Corte favorecedor.',
    'vestidos': 'Caída ligera y corte cómodo para cualquier ocasión.',
    'accesorios': 'Diseño elegante, correa ajustable.',
    'regalos': 'El detalle perfecto para regalar o decorar.',
}

def safe(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(urllib.parse.unquote(p.path), safe='/'), '', ''))

def fetch(cat):
    url = f'https://dummyjson.com/products/category/{cat}?limit=0&select=title,brand,price,images,thumbnail'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'sunnypos-demo'}), timeout=30) as r:
        return json.load(r)['products']

base = []  # (código, etiqueta, sustantivos, marca, precio_usd, imágenes)
for cat, destinos in MAPA.items():
    for i, p in enumerate(fetch(cat)):
        code, label, nouns = destinos[i % len(destinos)]
        imgs = [safe(u) for u in p.get('images') or []][:6]
        if imgs:
            base.append((code, label, nouns, p.get('brand') or '', p['price'], imgs))
print(len(base), 'productos base con foto')

def precio_mx(usd):
    usd = min(max(usd, 3), 90)                   # rango de boutique: ~$49 a ~$1,800
    v = max(49, usd * random.uniform(14, 20))
    v = int(round(v / 10.0)) * 10 - 1          # termina en 9: $249, $1,299
    return max(49, v)

rows, nombres = [], set()
i = 0
while len(rows) < N:
    code, label, nouns, marca, usd, imgs = base[i % len(base)]
    i += 1
    nombre = f'{random.choice(nouns)} {random.choice(COLORES)}'
    if random.random() < 0.5: nombre += f' {random.choice(DETALLES)}'
    if marca and random.random() < 0.6: nombre += f' {marca}'
    if code in ('blusas', 'vestidos'): nombre += f' talla {random.choice(TALLAS)}'
    elif code == 'calzado': nombre += f' #{random.choice(NUMEROS)}'
    elif code == 'perfumes': nombre += f' {random.choice(ML)}'
    if nombre in nombres: continue
    nombres.add(nombre)
    n = len(rows)
    precio = precio_mx(usd)
    oferta = random.random() < 0.12
    stock = 0 if random.random() < 0.08 else random.choice([1, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15])
    cat_code, cat_label = (('por_revisar', 'Por revisar') if random.random() < 0.02 else (code, label))
    fotos = imgs[:]
    random.shuffle(fotos) if random.random() < 0.3 else None
    rows.append({
        'name': nombre[:1].upper() + nombre[1:],
        'category': cat_code, 'category_label': cat_label,
        'price': precio,
        'original_price': int(round(precio * random.uniform(1.2, 1.5) / 10.0)) * 10 - 1 if oferta else None,
        'cost': round(precio * random.uniform(0.45, 0.65)) if random.random() < 0.92 else None,
        'description': DESC[code],
        'image': fotos[0],
        'images': fotos[1:6] or None,
        'stock': stock,
        'barcode': f'75{random.randint(0, 99999):05d}{n:06d}' if random.random() < 0.85 else None,
        'supplier_code': f'PRV-{n:05d}' if random.random() < 0.4 else None,
        'featured': random.random() < 0.04,
        'is_published': random.random() < 0.9,
        'is_archived': random.random() < 0.01,
        'expiry_date': (f'2027-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}'
                        if code in ('maquillaje', 'cuidado_personal', 'perfumes') and random.random() < 0.5 else None),
        'badge_type': 'promo' if oferta else ('new' if random.random() < 0.05 else None),
        'badge': '🔥 Oferta' if oferta else None,
        'position': n,
        'created_by': 'demo',
    })

COLS = """name, category, category_label, price, original_price, cost, description, image, images,
  stock, barcode, supplier_code, featured, is_published, is_archived, expiry_date, badge, badge_type, "position", created_by"""
for k in range(0, len(rows), 1000):
    data = json.dumps(rows[k:k + 1000], ensure_ascii=False).replace('$demo$', '')
    run_sql(f"""
INSERT INTO public.products ({COLS})
SELECT {COLS}
FROM jsonb_to_recordset($demo${data}$demo$::jsonb) AS x(
  name text, category text, category_label text, price numeric, original_price numeric, cost numeric, description text,
  image text, images jsonb, stock int, barcode text, supplier_code text, featured boolean, is_published boolean,
  is_archived boolean, expiry_date date, badge text, badge_type text, "position" int, created_by text);
SELECT count(*) AS productos_demo FROM public.products WHERE created_by = 'demo';
""")
