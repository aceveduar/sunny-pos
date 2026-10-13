"""Corre SQL en Sunny POS Pruebas vía Management API. Uso: q.py archivo.sql | q.py -e "select ..." """
import json, os, sys, urllib.request

REF = 'aduahsqbmborplojhubw'
tok = open(os.path.expanduser('~/sunnypos-token.txt'), encoding='utf-8-sig').read().strip()
sql = sys.argv[2] if sys.argv[1] == '-e' else open(sys.argv[1], encoding='utf-8').read()
req = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{REF}/database/query',
    data=json.dumps({'query': sql}).encode('utf-8'),
    headers={'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json', 'User-Agent': 'sunnypos-install'},
    method='POST')
try:
    with urllib.request.urlopen(req, timeout=300) as r:
        body = r.read().decode('utf-8')
        try:
            for row in json.loads(body): print(' | '.join(str(v) for v in row.values()))
        except Exception: print(body[:3000])
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode('utf-8')[:3000]); sys.exit(1)
