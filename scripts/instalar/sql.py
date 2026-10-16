"""Corre SQL en el proyecto de Supabase del negocio vía Management API.

Uso:  sql.py archivo.sql | sql.py -e "select ..."   (--raw: imprime el resultado como JSON)
El proyecto sale de negocio.js (supabaseUrl); se puede forzar con SUPABASE_REF.
El token sale de ~/sunnypos-token.txt (o la ruta en SUPABASE_TOKEN_FILE): nunca va en el repo.
También se importa como módulo: query(sql) -> filas, proyecto() -> ref.
"""
import json, os, re, sys, urllib.request

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def proyecto():
    if os.environ.get('SUPABASE_REF'): ref = os.environ['SUPABASE_REF']
    else:
        src = open(os.path.join(RAIZ, 'negocio.js'), encoding='utf-8').read()
        m = re.search(r"supabaseUrl:\s*'https://([a-z0-9]+)\.supabase\.co'", src)
        if not m: sys.exit('negocio.js no tiene supabaseUrl')
        ref = m.group(1)
    # Candado: la base de Tres Encantos (piloto, otro repo) nunca se toca desde aquí
    if ref == 'qxvrggmpaqhslgdmbhqw': sys.exit('ERROR: ese es el proyecto de Tres Encantos; Sunny POS no se conecta ahi.')
    return ref

def _token():
    ruta = os.environ.get('SUPABASE_TOKEN_FILE') or os.path.expanduser('~/sunnypos-token.txt')
    return open(ruta, encoding='utf-8-sig').read().strip()

def ejecutar(sql):
    """Devuelve el cuerpo de la respuesta (texto JSON). Lanza RuntimeError si falla."""
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{proyecto()}/database/query',
        data=json.dumps({'query': sql}).encode('utf-8'),
        headers={'Authorization': f'Bearer {_token()}', 'Content-Type': 'application/json', 'User-Agent': 'sunnypos'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code} {e.read().decode("utf-8")[:3000]}')

def query(sql):
    return json.loads(ejecutar(sql))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    RAW = '--raw' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--raw']
    sql = args[1] if args[0] == '-e' else open(args[0], encoding='utf-8').read()
    try:
        body = ejecutar(sql)
    except RuntimeError as e:
        print(e); sys.exit(1)
    if RAW:
        print(body); sys.exit(0)
    try:
        for row in json.loads(body): print(' | '.join(str(v) for v in row.values()))
    except Exception: print(body[:3000])
