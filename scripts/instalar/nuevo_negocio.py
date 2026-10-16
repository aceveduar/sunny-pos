"""Asistente para instalar Sunny POS a un negocio nuevo, paso por paso.

Antes: crear el proyecto en Supabase (supabase.com → New project), con
"Data API" sí, "exponer tablas nuevas automáticamente" NO y RLS automática sí.

Uso:  python scripts/instalar/nuevo_negocio.py
      python scripts/instalar/nuevo_negocio.py --datos datos.json   (sin preguntas; para repetir)

Hace, en orden: revisa el proyecto → instala la estructura (01) y los datos
iniciales (02) → espera a que crees la cuenta de la dueña → la hace dueña (03)
→ escribe clientes/<negocio>/negocio.js listo para publicar. Si algo falla, se
puede volver a correr: no repite lo que ya está hecho.
Usa el token de ~/sunnypos-token.txt (nunca se guarda en el repo).
"""
import base64, json, os, re, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, AQUI)
import sql  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
PROHIBIDO = 'qxvrggmpaqhslgdmbhqw'  # Tres Encantos: nunca se toca desde aquí

def paso(n, txt): print(f'\n── Paso {n}. {txt}')
def pedir(txt, defecto='', valida=None):
    while True:
        v = input(f'   {txt}{f" [{defecto}]" if defecto else ""}: ').strip() or defecto
        error = valida(v) if valida else None
        if not error: return v
        print(f'   ✗ {error}')
def si_no(txt, defecto=True):
    v = input(f'   {txt} ({"S/n" if defecto else "s/N"}): ').strip().lower()
    return defecto if not v else v.startswith('s')

def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'negocio'

def ref_de_llave(llave):
    try:
        cuerpo = llave.split('.')[1]; cuerpo += '=' * (-len(cuerpo) % 4)
        datos = json.loads(base64.urlsafe_b64decode(cuerpo))
        return datos.get('ref') if datos.get('role') == 'anon' else None
    except Exception:
        return None

def datos_interactivos():
    paso(1, 'Datos del negocio')
    d = {}
    d['nombre'] = pedir('Nombre del negocio (como lo verán sus clientas)', valida=lambda v: None if v else 'Escribe el nombre')
    d['url'] = pedir('Project URL de Supabase (Settings → API, ej. https://abcd.supabase.co)',
                     valida=lambda v: None if re.fullmatch(r'https://[a-z0-9]{20}\.supabase\.co/?', v) else 'Debe verse como https://xxxxxxxxxxxxxxxxxxxx.supabase.co')
    ref = re.search(r'https://([a-z0-9]+)\.', d['url']).group(1)
    d['anon'] = pedir('anon public key (Settings → API)', valida=lambda v: None if ref_de_llave(v) == ref else 'Esa llave no es la "anon" de este proyecto')
    d['whatsapp'] = pedir('WhatsApp del negocio, 10 dígitos (vacío = sin WhatsApp)', valida=lambda v: None if not v or re.fullmatch(r'\d{10}', v) else 'Son 10 dígitos, sin espacios')
    d['duena_nombre'] = pedir('Nombre de la dueña (para "Ya lo cobró …")', valida=lambda v: None if v else 'Escribe su nombre')
    d['duena_correo'] = pedir('Correo con el que entrará la dueña', valida=lambda v: None if re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', v) else 'Correo no válido').lower()
    d['color'] = pedir('Color de marca en hex', '#4F7461', valida=lambda v: None if re.fullmatch(r'#[0-9a-fA-F]{6}', v) else 'Formato #RRGGBB')
    d['tienda'] = si_no('¿Incluye Tienda en línea?')
    d['fiado'] = si_no('¿Da fiado ("se lo lleva hoy y paga después")?')
    d['tarjeta'] = si_no('¿Cobra con terminal de tarjeta?')
    return d

def main():
    if '--datos' in sys.argv:
        d = json.load(open(sys.argv[sys.argv.index('--datos') + 1], encoding='utf-8'))
    else:
        print('Asistente de instalación de Sunny POS. Ctrl+C para salir en cualquier momento.')
        d = datos_interactivos()
    ref = re.search(r'https://([a-z0-9]+)\.', d['url']).group(1)
    if ref == PROHIBIDO: sys.exit('✗ Ese es el proyecto de Tres Encantos: no se instala nada ahí.')
    if ref_de_llave(d['anon']) != ref: sys.exit('✗ La anon key no corresponde a ese proyecto.')
    os.environ['SUPABASE_REF'] = ref

    paso(2, f'Revisar el proyecto {ref}')
    try:
        ya = sql.query("select to_regclass('public.products') is not null as hay")[0]['hay']
    except Exception as e:
        sys.exit(f'✗ No pude entrar al proyecto ({str(e)[:200]}).\n  ¿El token de ~/sunnypos-token.txt es de la cuenta donde está ese proyecto?')
    print('   ✓ Conectado' + (' (ya tiene la estructura: me salto la instalación)' if ya else ''))

    if not ya:
        paso(3, 'Instalar la estructura (tarda 1–2 minutos)')
        sql.ejecutar(open(os.path.join(RAIZ, 'supabase', 'instalar', '01_estructura.sql'), encoding='utf-8').read())
        print('   ✓ Estructura instalada')
        sql.ejecutar(open(os.path.join(RAIZ, 'supabase', 'instalar', '02_datos_iniciales.sql'), encoding='utf-8').read())
        print('   ✓ Categorías y ajustes iniciales')
    else:
        paso(3, 'Aplicar mejoras pendientes (por si la base es de una versión anterior)')
        sql.ejecutar(open(os.path.join(AQUI, 'mejoras.sql'), encoding='utf-8').read())
        print('   ✓ Base al día')

    correo = d['duena_correo'].replace("'", '')
    paso(4, 'Cuenta de la dueña')
    existe = lambda: sql.query(f"select count(*) as n from auth.users where lower(email) = '{correo}'")[0]['n'] > 0
    while not existe():
        if '--datos' in sys.argv: sys.exit(f'✗ Falta crear la cuenta {correo} en Authentication → Users.')
        print(f'   En Supabase: Authentication → Users → Add user → Create new user')
        print(f'   Correo: {correo} · contraseña de 10+ caracteres con letras y números · marca "Auto Confirm User"')
        input('   Cuando la crees, presiona Enter… ')
    sql.ejecutar(open(os.path.join(RAIZ, 'supabase', 'instalar', '03_primera_duena.sql'), encoding='utf-8').read().replace('CORREO_DE_LA_DUENA', correo))
    print(f'   ✓ {correo} es la dueña (superadmin)')

    paso(5, 'Archivo negocio.js del negocio')
    src = open(os.path.join(RAIZ, 'negocio.js'), encoding='utf-8').read()
    js = lambda v: "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"
    cambios = [
        (r"^  nombre: '[^']*',", f"  nombre: {js(d['nombre'])},"),
        (r"^  supabaseUrl: '[^']*',", f"  supabaseUrl: {js(d['url'].rstrip('/'))},"),
        (r"^  supabaseAnonKey: '[^']*',", f"  supabaseAnonKey: {js(d['anon'])},"),
        (r"^  whatsapp: '[^']*',", f"  whatsapp: {js(d.get('whatsapp', ''))},"),
        (r"^  duena: \{[^}]*\},", f"  duena: {{ nombre: {js(d['duena_nombre'])}, correo: {js(correo)} }},"),
        (r"^  modulos: \{[^}]*\},", f"  modulos: {{ tienda: {str(d.get('tienda', True)).lower()}, fiado: {str(d.get('fiado', True)).lower()} }},"),
        (r"^  formasDePago: \[[^\]]*\],", "  formasDePago: ['efectivo', 'transferencia'" + (", 'tarjeta'" if d.get('tarjeta', True) else '') + "],"),
        (r"^  color: '[^']*',", f"  color: {js(d.get('color', '#4F7461'))},"),
    ]
    for patron, nuevo in cambios:
        src, n = re.subn(patron, lambda _m: nuevo, src, count=1, flags=re.M)
        if not n: sys.exit(f'✗ negocio.js cambió y no encontré: {patron}')
    carpeta = os.path.join(RAIZ, 'clientes', slug(d['nombre']))
    os.makedirs(carpeta, exist_ok=True)
    destino = os.path.join(carpeta, 'negocio.js')
    open(destino, 'w', encoding='utf-8', newline='\n').write(src)
    print(f'   ✓ {os.path.relpath(destino, RAIZ)}')
    # Vista previa al compartir la Tienda por WhatsApp: va escrita en el HTML (WhatsApp no ejecuta JS)
    if d.get('tienda', True):
        import html
        idx = open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
        titulo = html.escape(d['nombre'], quote=True)
        desc = html.escape(d.get('descripcion') or f"Catálogo de {d['nombre']} con pedidos por WhatsApp.", quote=True)
        idx = re.sub(r'<title>[^<]*</title>', f'<title>{titulo}</title>', idx, count=1)
        idx = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + titulo, idx, count=1)
        for patron in (r'(<meta name="description" content=")[^"]*', r'(<meta property="og:description" content=")[^"]*'):
            idx = re.sub(patron, lambda m: m.group(1) + desc, idx, count=1)
        open(os.path.join(carpeta, 'index.html'), 'w', encoding='utf-8', newline='\n').write(idx)
        print(f'   ✓ {os.path.relpath(os.path.join(carpeta, "index.html"), RAIZ)} (vista previa al compartir con su nombre)')

    paso(6, 'Lo que sigue (a mano)')
    print(f'''   1. Publicar la app con los archivos de {os.path.relpath(carpeta, RAIZ)} en lugar de los de pruebas.
   2. Si quiere foto en la vista previa de WhatsApp: agregar og:image en ese index.html.
   3. Fotos en Drive: Configuración → Integraciones → Google Drive (instrucciones ahí mismo).
   4. IA (opcional): Configuración → Integraciones → clave de Groq.
   5. Respaldo diario: programar  python scripts/respaldo.py  con SUPABASE_REF={ref}.
   6. La dueña entra con {correo}; la guía "Primeros pasos" de Inventario la lleva por lo demás.''')

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\n   Cancelado. Puedes volver a correrlo: no repite lo que ya quedó.')
