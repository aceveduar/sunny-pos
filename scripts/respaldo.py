"""Respaldo completo del negocio (Supabase no tiene respaldos en el plan gratis).

Uso:  python scripts/respaldo.py
Guarda <Documentos>/SunnyPOS-Respaldos/<negocio>_<fecha>.zip con:
  - datos/<tabla>.json  todas las tablas de public (una tabla nueva entra sola)
  - estructura.sql      la base completa, lista para instalar en un proyecto vacío
  - auth_usuarios.json  cuentas (correo, rol, fechas) SIN contraseñas
  - LEEME.txt           cómo restaurar
Conserva los últimos 30 y anota el resultado en config.ultimo_respaldo
(Configuración → Datos lo muestra a la dueña). Bitácora en respaldo.log.
Proyecto y token: los mismos que scripts/instalar/sql.py (negocio.js + ~/sunnypos-token.txt).
"""
import datetime as dt, json, os, re, shutil, sys, tempfile, zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, 'instalar'))
import sql  # noqa: E402

CONSERVAR = 30
DESTINO = os.path.join(os.path.expanduser('~'), 'Documents', 'SunnyPOS-Respaldos')
os.makedirs(DESTINO, exist_ok=True)
LOG = os.path.join(DESTINO, 'respaldo.log')

def log(msg):
    linea = f'{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}'
    print(linea)
    with open(LOG, 'a', encoding='utf-8') as f: f.write(linea + '\n')

def nombre_negocio():
    src = open(os.path.join(sql.RAIZ, 'negocio.js'), encoding='utf-8').read()
    m = re.search(r"nombre:\s*'([^']*)'", src)
    return re.sub(r'[^A-Za-z0-9]+', '', (m.group(1) if m else 'Negocio').title()) or 'Negocio'

def guardar_estado(ok, mb, tablas, errores):
    try:
        estado = json.dumps({'ok': ok, 'mb': mb, 'tablas': tablas, 'errores': errores})
        sql.ejecutar(f"""INSERT INTO public.config (id, value)
          SELECT 'ultimo_respaldo', (jsonb_build_object('at', now()) || $e${estado}$e$::jsonb)::text
          ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();""")
    except Exception as e:
        log(f'No se pudo anotar el resultado en config: {e}')

stamp = dt.datetime.now().strftime('%Y-%m-%d_%H%M')
tmp = tempfile.mkdtemp(prefix='respaldo_')
errores = []
try:
    tablas = [r['table_name'] for r in sql.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")]
    if not tablas: raise RuntimeError('no se pudo leer la lista de tablas')
    os.makedirs(os.path.join(tmp, 'datos'))
    total_filas = 0
    for t in tablas:
        try:
            body = sql.ejecutar(f'SELECT COALESCE(json_agg(x), \'[]\') AS filas FROM public."{t}" x')
            filas = json.loads(body)[0]['filas']
            with open(os.path.join(tmp, 'datos', f'{t}.json'), 'w', encoding='utf-8') as f:
                json.dump(filas, f, ensure_ascii=False)
            total_filas += len(filas)
        except Exception as e:
            errores.append(t); log(f'ERROR exportando {t}: {str(e)[:300]}')
    # Estructura instalable: el mismo generador del instalador, sobre esta base
    try:
        filas_ddl = sql.query(open(os.path.join(AQUI, 'instalar', 'leer_estructura.sql'), encoding='utf-8').read())
        ddl_json = os.path.join(tmp, '_ddl.json')
        json.dump(filas_ddl, open(ddl_json, 'w', encoding='utf-8'), ensure_ascii=False)
        import subprocess
        r = subprocess.run([sys.executable, os.path.join(AQUI, 'instalar', 'generar_estructura.py'), ddl_json,
                            os.path.join(tmp, 'estructura.sql')], capture_output=True, text=True)
        os.remove(ddl_json)
        if r.returncode: raise RuntimeError(r.stderr[-300:])
    except Exception as e:
        errores.append('estructura'); log(f'ERROR en la estructura: {str(e)[:300]}')
    try:
        usuarios = sql.query("SELECT id, email, raw_app_meta_data, raw_user_meta_data, created_at, last_sign_in_at FROM auth.users ORDER BY created_at")
        json.dump(usuarios, open(os.path.join(tmp, 'auth_usuarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    except Exception as e:
        errores.append('auth'); log(f'ERROR en usuarios: {str(e)[:300]}')
    open(os.path.join(tmp, 'LEEME.txt'), 'w', encoding='utf-8').write(f"""Respaldo de {nombre_negocio()} — {stamp}

Contenido
  datos/<tabla>.json   todas las tablas (una lista de renglones por archivo)
  estructura.sql       base completa: tablas, funciones, reglas de seguridad, permisos
  auth_usuarios.json   cuentas SIN contraseña (al restaurar, cada persona fija la suya
                       con "Olvidé mi contraseña" o se le invita de nuevo)

Restaurar en un proyecto de Supabase nuevo y vacío
  1. Correr estructura.sql (SQL Editor o scripts/instalar/sql.py estructura.sql).
  2. Crear las cuentas (Authentication → Users) con los mismos correos.
  3. Cargar datos/*.json, primero las tablas sin dependencias (config, customers,
     products), luego sales, sale_payments y el resto, con los mismos id; al final
     ajustar las secuencias (setval) al id mayor de cada tabla.
  Lo más seguro: pedírselo a Claude en la carpeta del proyecto, con este .zip.
""")
    zip_path = os.path.join(DESTINO, f'{nombre_negocio()}_{stamp}.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for raiz, _, archivos in os.walk(tmp):
            for a in archivos:
                full = os.path.join(raiz, a); z.write(full, os.path.relpath(full, tmp))
    mb = round(os.path.getsize(zip_path) / 1048576, 2)
    viejos = sorted(f for f in os.listdir(DESTINO) if f.startswith(nombre_negocio() + '_') and f.endswith('.zip'))
    for f in viejos[:-CONSERVAR]: os.remove(os.path.join(DESTINO, f))
    ok = not errores
    log(f"{'OK' if ok else 'CON ERRORES'}  {zip_path}  {mb} MB  {len(tablas)} tablas  {total_filas} renglones" + (f'  fallaron: {errores}' if errores else ''))
    guardar_estado(ok, mb, len(tablas), errores)
    sys.exit(0 if ok else 1)
except Exception as e:
    log(f'ERROR: {e}')
    guardar_estado(False, 0, 0, [str(e)[:200]])
    sys.exit(1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
