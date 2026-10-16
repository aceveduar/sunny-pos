"""Prendas de demostración con tallas/colores y foto (para enseñar la Tienda y Caja).

Uso:  python scripts/demo/variantes_demo.py          (crea ~30 prendas)
      python scripts/demo/variantes_demo.py --borrar (quita las prendas demo con variantes)
Fotos: catálogo público de dummyjson.com (solo pruebas). Todo lleva created_by='demo'.
"""
import json, os, random, sys, urllib.parse, urllib.request, uuid

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'instalar'))
import sql  # noqa: E402

if '--borrar' in sys.argv:
    sql.ejecutar("DELETE FROM public.recently_edited WHERE product_id IN (SELECT id FROM public.products WHERE created_by='demo' AND variant_group IS NOT NULL);"
                 "DELETE FROM public.product_changes WHERE product_id IN (SELECT id FROM public.products WHERE created_by='demo' AND variant_group IS NOT NULL);"
                 "DELETE FROM public.products p WHERE created_by='demo' AND variant_group IS NOT NULL "
                 "AND NOT EXISTS (SELECT 1 FROM public.sales s, jsonb_array_elements(s.items) i WHERE (i->>'id')::bigint = p.id);")
    print(sql.query("SELECT count(*) AS quedan FROM public.products WHERE created_by='demo' AND variant_group IS NOT NULL"))
    sys.exit()

random.seed(21)

def safe(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(urllib.parse.unquote(p.path), safe='/'), '', ''))

def fotos(cat):
    url = f'https://dummyjson.com/products/category/{cat}?limit=0&select=title,images'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'sunnypos-demo'}), timeout=30) as r:
        return [[safe(u) for u in p['images']][:5] for p in json.load(r)['products'] if p.get('images')]

TALLAS = ['CH', 'M', 'G', 'EG']
COLORES = ['Negro', 'Blanco', 'Beige', 'Rosa', 'Azul marino', 'Verde olivo', 'Vino', 'Camel']
# (categoría dummyjson, código, etiqueta, nombres, opciones, precio)
PLAN = [
    ('tops', 'blusas', 'Blusas', ['Blusa de lino', 'Top de punto', 'Blusa con moño', 'Playera básica', 'Blusa satinada'], 'talla_color', (329, 549)),
    ('mens-shirts', 'blusas', 'Blusas', ['Camisa de mezclilla', 'Camisa oversize', 'Camisa a cuadros', 'Camisa de lino', 'Camisa casual'], 'talla_color', (399, 649)),
    ('womens-dresses', 'vestidos', 'Vestidos', ['Vestido midi', 'Vestido floreado', 'Vestido de noche', 'Vestido casual', 'Vestido camisero'], 'talla_color', (549, 989)),
    ('womens-shoes', 'calzado', 'Calzado', ['Zapatilla clásica', 'Sandalia de tacón', 'Tenis urbano', 'Botín de piel', 'Flats cómodos'], 'numero_color', (599, 1290)),
    ('womens-bags', 'bolsos', 'Bolsos', ['Bolso tote', 'Bolso cruzado', 'Cartera de mano', 'Mochila urbana', 'Bolso de hombro'], 'color', (489, 1190)),
    ('sunglasses', 'lentes', 'Lentes', ['Lentes aviador', 'Lentes cat eye', 'Lentes redondos', 'Lentes deportivos', 'Lentes clásicos'], 'mica', (279, 599)),
]

pos0 = sql.query("SELECT COALESCE(max(position),0)+1 AS n FROM public.products")[0]['n']
filas, prendas = [], 0
for cat_dj, code, label, nombres, tipo, (pmin, pmax) in PLAN:
    imgs = fotos(cat_dj)
    for nombre, ims in zip(nombres, imgs):
        grupo = str(uuid.uuid4()); prendas += 1
        precio = round(random.randint(pmin, pmax) / 10) * 10 - 1
        costo = round(precio * random.uniform(.45, .6))
        colores = random.sample(COLORES, random.choice([2, 3]))
        if tipo == 'talla_color':
            combos = [[['Talla', t], ['Color', c]] for t in TALLAS for c in colores]
        elif tipo == 'numero_color':
            combos = [[['Número', n], ['Color', c]] for n in ['22', '23', '24', '25', '26'] for c in colores[:2]]
        elif tipo == 'color':
            combos = [[['Color', c]] for c in random.sample(COLORES, 4)]
        else:
            combos = [[['Mica', c]] for c in ['Negra', 'Café', 'Espejo', 'Degradada']]
        descripcion = {'blusas': 'Tela fresca y cómoda. Corte favorecedor para el día a día.',
                       'vestidos': 'Caída ligera y corte cómodo para cualquier ocasión.',
                       'calzado': 'Plantilla acolchada para usar todo el día.',
                       'bolsos': 'Amplio, ligero y con cierre seguro.',
                       'lentes': 'Protección UV400. Incluye estuche.'}[code]
        for v in combos:
            stock = 0 if random.random() < .18 else random.choice([1, 1, 2, 2, 3, 4, 5, 6])
            filas.append({
                'name': f"{nombre} · {' · '.join(x[1] for x in v)}", 'variant_base': nombre, 'variant': v, 'variant_group': grupo,
                'category': code, 'category_label': label, 'price': precio, 'cost': costo, 'description': descripcion,
                'image': ims[0], 'images': ims[1:] or None, 'stock': stock, 'is_published': True,
                'barcode': f'789{random.randint(0, 999):03d}{len(filas):06d}', 'position': pos0 + len(filas), 'created_by': 'demo',
            })

data = json.dumps(filas, ensure_ascii=False)
sql.ejecutar(f"""INSERT INTO public.products (name, variant_base, variant, variant_group, category, category_label, price, cost, description,
  image, images, stock, is_published, barcode, position, created_by)
SELECT name, variant_base, variant, variant_group, category, category_label, price, cost, description, image, images, stock, is_published, barcode, position, created_by
FROM jsonb_to_recordset($d${data}$d$::jsonb) AS x(name text, variant_base text, variant jsonb, variant_group uuid, category text, category_label text,
  price numeric, cost numeric, description text, image text, images jsonb, stock int, is_published boolean, barcode text, position int, created_by text);""")
print(f'{prendas} prendas, {len(filas)} variantes')
