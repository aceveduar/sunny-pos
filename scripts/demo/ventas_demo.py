"""Historial de ventas de demostración para que Reportes se vea completo.

~4 meses hacia atrás: ventas directas, apartados (anticipo, abonos, liquidación,
algunos vencidos y cancelados), clientas, y un turno de caja por día con su corte.
Escribe directo en la base (las RPC solo registran "ahora"), con las mismas
reglas de datos: libro de pagos por paid_at, fuentes rpc_*, montos con signo.

Todo queda a nombre de cajeras ficticias @demo.sunnypos; se borra con:
    python scripts/demo/ventas_demo.py --borrar
No toca existencias (el inventario de demo se queda igual).
"""
import datetime as dt, json, os, random, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SQL = os.path.join(HERE, '..', 'instalar', 'sql.py')
DOM = '@demo.sunnypos'
CAJERAS = {'ana' + DOM: 'Ana', 'lupita' + DOM: 'Lupita'}
TZ = dt.timezone(dt.timedelta(hours=-6))  # Ciudad de México (sin horario de verano)

def run_sql(sql, show=True, raw=False):
    fd, tmp = tempfile.mkstemp(suffix='.sql')
    with os.fdopen(fd, 'w', encoding='utf-8') as f: f.write(sql)
    r = subprocess.run([sys.executable, SQL, tmp] + (['--raw'] if raw else []), capture_output=True, text=True, encoding='utf-8')
    try: os.remove(tmp)
    except OSError: pass
    out = (r.stdout + r.stderr).strip()
    if show and out: print(out[:600])
    if r.returncode: sys.exit(1)
    return out

BORRAR = f"""
SET LOCAL sunnypos.rpc_v2 = 'on';
DELETE FROM public.sale_payments WHERE sale_id IN (SELECT id FROM public.sales WHERE seller_email LIKE '%{DOM}');
DELETE FROM public.sales WHERE seller_email LIKE '%{DOM}';
DELETE FROM public.cash_shift_expenses WHERE created_by_email LIKE '%{DOM}';
DELETE FROM public.cash_shifts WHERE user_email LIKE '%{DOM}';
DELETE FROM public.customers WHERE created_by_email LIKE '%{DOM}';
"""
if '--borrar' in sys.argv:
    run_sql('BEGIN;' + BORRAR + "COMMIT; SELECT count(*) AS ventas_demo FROM public.sales WHERE seller_email LIKE '%" + DOM + "';")
    sys.exit()

random.seed(13)
DIAS = int(next((a for a in sys.argv[1:] if a.isdigit()), 120))

# Productos publicados para vender (con algunos "estrella" que se venden más)
def query(sql): return json.loads(run_sql(sql, show=False, raw=True))
prods = query("SELECT id, name, price, category AS cat FROM public.products "
              "WHERE is_published AND NOT is_archived AND kit_items IS NULL AND price > 0 AND category <> 'por_revisar'")
random.shuffle(prods)
estrellas = prods[:40]
def producto():
    return random.choice(estrellas) if random.random() < .35 else random.choice(prods)

NOMBRES = ['María', 'Guadalupe', 'Rosa', 'Ana', 'Fernanda', 'Daniela', 'Karla', 'Alejandra', 'Patricia', 'Sofía', 'Valeria',
           'Mariana', 'Verónica', 'Laura', 'Gabriela', 'Claudia', 'Adriana', 'Paola', 'Leticia', 'Jimena', 'Elena', 'Norma']
APELLIDOS = ['García', 'Hernández', 'López', 'Martínez', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz',
             'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Ruiz', 'Mendoza', 'Aguilar']
clientas = []
usados = set()
while len(clientas) < 45:
    n = f'{random.choice(NOMBRES)} {random.choice(APELLIDOS)}'
    if n in usados: continue
    usados.add(n)
    clientas.append({'name': n, 'phone': '55' + ''.join(random.choice('0123456789') for _ in range(8))})
frecuentes = clientas[:12]

next_sale = query("SELECT COALESCE(max(id),0) + 10 AS n FROM public.sales")[0]['n']
next_cust = query("SELECT COALESCE(max(id),0) + 10 AS n FROM public.customers")[0]['n']
for c in clientas:
    c['id'] = next_cust; next_cust += 1

HORAS = {10: .5, 11: .8, 12: 1, 13: 1.3, 14: 1.1, 15: .8, 16: .9, 17: 1.2, 18: 1.4, 19: 1.1, 20: .5}
DOW = [.8, .8, .9, 1, 1.25, 1.6, .55]  # lunes..domingo

hoy = dt.datetime.now(TZ)
inicio = (hoy - dt.timedelta(days=DIAS)).replace(hour=0, minute=0, second=0, microsecond=0)
sales, pays, shifts, exps = [], [], [], []

def ts(d): return d.astimezone(dt.timezone.utc).isoformat()

def items_venta(n_items):
    out, total = [], 0
    for _ in range(n_items):
        p = producto(); q = 1 if random.random() < .88 else 2
        out.append({'id': p['id'], 'qty': q, 'name': p['name'], 'price': float(p['price']), 'subtotal': float(p['price']) * q, 'kit_items': [], 'kit_snapshot_estimated': False})
        total += float(p['price']) * q
    return out, total

def momento(dia):
    h = random.choices(list(HORAS), weights=list(HORAS.values()))[0]
    return dia.replace(hour=h, minute=random.randint(0, 59), second=random.randint(0, 59))

def cajera_de(dia): return ('lupita' if dia.weekday() >= 5 else 'ana') + DOM

def pago(sale_id, kind, amount, method, when, who, source):
    pays.append({'sale_id': sale_id, 'kind': kind, 'amount': round(amount, 2), 'method': method, 'paid_at': ts(when),
                 'collected_by_email': who, 'source': source})

dia = inicio
k = 0
while dia.date() <= hoy.date():
    k += 1
    factor = DOW[dia.weekday()] * (1.3 if dia.day in (1, 15, 16, 30, 31) else 1) * (0.85 + 0.35 * k / DIAS)
    n = max(2, int(random.gauss(9 * factor, 2)))
    for _ in range(n):
        when = momento(dia)
        if when > hoy: continue
        who = cajera_de(dia)
        sid = next_sale; next_sale += 1
        nitems = random.choices([1, 2, 3], weights=[60, 28, 12])[0]
        apartado = random.random() < .14
        if apartado: nitems = max(nitems, 2)
        items, total = items_venta(nitems)
        desc = 0
        if not apartado and random.random() < .08:
            desc = round(total * random.choice([.05, .1, .15]) / 10) * 10
        total = total - desc
        metodo = 'efectivo' if random.random() < .7 else 'transferencia'
        cli = random.choice(frecuentes) if random.random() < .5 else random.choice(clientas)
        con_cliente = apartado or random.random() < .25
        s = {'id': sid, 'created_at': ts(when), 'total': total, 'items': items, 'discount': desc or None, 'payment_method': metodo,
             'type': 'apartado' if apartado else 'venta', 'origin_type': 'apartado' if apartado else 'venta',
             'customer': f"{cli['name']} · 📱 {cli['phone']}" if con_cliente else None, 'customer_id': cli['id'] if con_cliente else None,
             'seller_email': who, 'due_date': None, 'status': 'liquidado', 'liquidated_at': None, 'last_payment_at': ts(when),
             'cancelled_at': None, 'paid_amount': total, 'updated_at': ts(when)}
        if not apartado:
            s['liquidated_at'] = ts(when)
            pago(sid, 'payment', total, metodo, when, who, 'rpc_direct_sale')
            if random.random() < .01:  # venta cancelada el mismo día
                s['status'] = 'cancelado'; c = when + dt.timedelta(minutes=random.randint(5, 90))
                s['cancelled_at'] = ts(c); s['paid_amount'] = 0
                pago(sid, 'refund', -total, metodo, c, who, 'rpc_sale_cancellation_refund')
        else:
            due = (when + dt.timedelta(days=30)).date()
            s['due_date'] = due.isoformat()
            anticipo = max(50, round(total * random.uniform(.2, .4) / 50) * 50)
            pagado = anticipo
            pago(sid, 'payment', anticipo, metodo, when, who, 'rpc_apartado_initial')
            destino = random.choices(['liquidado', 'activo', 'cancelado'], weights=[72, 20, 8])[0]
            t = when
            for _ in range(random.randint(1, 3)):
                t = t + dt.timedelta(days=random.randint(4, 12))
                if t > hoy or pagado >= total: break
                resto = total - pagado
                monto = min(resto - 50, max(100, round(resto * random.uniform(.3, .6) / 50) * 50)) if destino != 'liquidado' else min(resto, max(100, round(resto * random.uniform(.3, .6) / 50) * 50))
                if monto <= 0: break
                t2 = momento(t)
                if t2 > hoy: break
                pagado += monto
                src = 'rpc_apartado_liquidation' if pagado >= total else 'rpc_apartado_payment'
                pago(sid, 'payment', monto, random.choice(['efectivo', 'efectivo', 'transferencia']), t2, cajera_de(t2), src)
                s['last_payment_at'] = ts(t2)
                if pagado >= total:
                    s['liquidated_at'] = ts(t2); break
            if destino == 'liquidado' and pagado < total:
                t2 = momento(min(hoy, when + dt.timedelta(days=random.randint(14, 28))))
                if t2 <= hoy:
                    pago(sid, 'payment', total - pagado, 'efectivo', t2, cajera_de(t2), 'rpc_apartado_liquidation')
                    pagado = total; s['liquidated_at'] = ts(t2); s['last_payment_at'] = ts(t2)
            if pagado >= total:
                s['status'] = 'liquidado'
            elif destino == 'cancelado' and (when + dt.timedelta(days=35)) < hoy:
                c = momento(when + dt.timedelta(days=35)); s['status'] = 'cancelado'; s['cancelled_at'] = ts(c)
                pago(sid, 'refund', -pagado, 'efectivo', c, cajera_de(c), 'rpc_sale_cancellation_refund'); pagado = 0
            else:
                s['status'] = 'activo'
            s['paid_amount'] = pagado
        sales.append(s)
    dia += dt.timedelta(days=1)

# Turnos: uno por día y cajera; el corte cuadra (a veces con diferencia chica)
efectivo_dia = {}
for p_ in pays:
    if p_['method'] != 'efectivo': continue
    d = dt.datetime.fromisoformat(p_['paid_at']).astimezone(TZ).date()
    key = (d, p_['collected_by_email'])
    efectivo_dia[key] = efectivo_dia.get(key, 0) + p_['amount']
GASTOS = [('Refresco y garrafón', 45), ('Taxi a paquetería', 90), ('Bolsas de regalo', 120), ('Limpieza', 60), ('Papel de ticket', 75)]
for (d, who), cash in sorted(efectivo_dia.items()):
    abre = dt.datetime.combine(d, dt.time(9, 50), TZ)
    cierra = dt.datetime.combine(d, dt.time(20, 35), TZ)
    abierto = d == hoy.date()
    gastos = retiros = 0
    sid_shift = len(shifts) + 1
    if random.random() < .3:
        g = random.choice(GASTOS); gastos += g[1]
        exps.append({'shift': sid_shift, 'description': g[0], 'amount': g[1], 'kind': 'gasto', 'created_at': ts(abre + dt.timedelta(hours=4)), 'created_by_email': who})
    if cash > 3000 and random.random() < .4:
        r = int(cash * .6 / 500) * 500; retiros += r
        exps.append({'shift': sid_shift, 'description': 'La dueña se lleva la venta', 'amount': r, 'kind': 'retiro', 'created_at': ts(abre + dt.timedelta(hours=8)), 'created_by_email': who})
    esperado = 500 + cash - gastos - retiros
    diff = 0 if random.random() < .85 else random.choice([-50, -20, -10, 10, 20])
    shifts.append({'n': sid_shift, 'user_email': who, 'opened_at': ts(abre), 'closed_at': None if abierto else ts(cierra), 'fondo_inicial': 500,
                   'conteo_final': None if abierto else esperado + diff, 'efectivo_neto': None if abierto else cash,
                   'gastos_total': None if abierto else gastos, 'esperado': None if abierto else esperado,
                   'diferencia': None if abierto else diff, 'status': 'abierto' if abierto else 'cerrado',
                   'retiros_total': retiros, 'created_at': ts(abre)})

print(f'{len(sales)} ventas/apartados, {len(pays)} pagos, {len(shifts)} turnos, {len(clientas)} clientas')

def jl(x): return json.dumps(x, ensure_ascii=False).replace('$d$', '')
sql = ['BEGIN;', BORRAR]
sql.append(f"""INSERT INTO public.customers (id, name, phone, created_by_email, created_at, updated_at)
SELECT id, name, phone, 'ana{DOM}', now() - interval '{DIAS} days', now() FROM jsonb_to_recordset($d${jl(clientas)}$d$::jsonb) AS x(id bigint, name text, phone text);""")
for i in range(0, len(sales), 400):
    sql.append(f"""INSERT INTO public.sales (id, created_at, total, items, discount, payment_method, type, origin_type, customer, customer_id,
  seller_email, due_date, status, liquidated_at, last_payment_at, cancelled_at, paid_amount, updated_at, version)
SELECT id, created_at, total, items, discount, payment_method, type, origin_type, customer, customer_id, seller_email, due_date,
  status, liquidated_at, last_payment_at, cancelled_at, paid_amount, updated_at, 0
FROM jsonb_to_recordset($d${jl(sales[i:i+400])}$d$::jsonb) AS x(id bigint, created_at timestamptz, total numeric, items jsonb, discount numeric,
  payment_method text, type text, origin_type text, customer text, customer_id bigint, seller_email text, due_date date, status text,
  liquidated_at timestamptz, last_payment_at timestamptz, cancelled_at timestamptz, paid_amount numeric, updated_at timestamptz);""")
for i in range(0, len(pays), 600):
    sql.append(f"""INSERT INTO public.sale_payments (sale_id, kind, amount, method, paid_at, recorded_at, collected_by_email, source, meta)
SELECT sale_id, kind, amount, method, paid_at, paid_at, collected_by_email, source, '{{"demo":true}}'::jsonb
FROM jsonb_to_recordset($d${jl(pays[i:i+600])}$d$::jsonb) AS x(sale_id bigint, kind text, amount numeric, method text, paid_at timestamptz, collected_by_email text, source text);""")
sql.append(f"""CREATE TEMP TABLE _sh ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset($d${jl(shifts)}$d$::jsonb) AS x(n int, user_email text, opened_at timestamptz,
  closed_at timestamptz, fondo_inicial numeric, conteo_final numeric, efectivo_neto numeric, gastos_total numeric, esperado numeric, diferencia numeric,
  status text, retiros_total numeric, created_at timestamptz);
CREATE TEMP TABLE _map (n int, id bigint) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO public.cash_shifts (user_email, opened_at, closed_at, fondo_inicial, conteo_final, efectivo_neto, gastos_total, esperado, diferencia, status, retiros_total, created_at)
  SELECT user_email, opened_at, closed_at, fondo_inicial, conteo_final, efectivo_neto, gastos_total, esperado, diferencia, status, retiros_total, created_at FROM _sh ORDER BY n
  RETURNING id, opened_at, user_email)
INSERT INTO _map SELECT s.n, ins.id FROM ins JOIN _sh s ON s.opened_at = ins.opened_at AND s.user_email = ins.user_email;
INSERT INTO public.cash_shift_expenses (shift_id, description, amount, kind, created_at, created_by_email)
SELECT m.id, x.description, x.amount, x.kind, x.created_at, x.created_by_email
FROM jsonb_to_recordset($d${jl(exps)}$d$::jsonb) AS x(shift int, description text, amount numeric, kind text, created_at timestamptz, created_by_email text)
JOIN _map m ON m.n = x.shift;""")
sql.append("SELECT setval('public.sales_id_seq', (SELECT max(id) FROM public.sales));")
sql.append("SELECT setval(pg_get_serial_sequence('public.customers','id'), (SELECT max(id) FROM public.customers));")
names = jl(CAJERAS)
sql.append(f"""INSERT INTO public.config (id, value) VALUES ('user_names', '{{}}') ON CONFLICT (id) DO NOTHING;
UPDATE public.config SET value = (value::jsonb || $d${names}$d$::jsonb)::text WHERE id = 'user_names';""")
sql.append('COMMIT;')
sql.append(f"SELECT count(*) AS ventas, sum(total)::int AS total FROM public.sales WHERE seller_email LIKE '%{DOM}';")
run_sql('\n'.join(sql))
