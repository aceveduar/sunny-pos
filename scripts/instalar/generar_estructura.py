"""Arma supabase/instalar/01_estructura.sql.

1. Correr leer_estructura.sql (solo lectura) contra la base piloto y guardar las filas en ddl.json.
2. python generar_estructura.py ddl.json supabase/instalar/01_estructura.sql
Agrega al final mejoras.sql (cambios de Sunny POS sobre el modelo del piloto).
"""
import json, sys, re, os

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src, encoding='utf-8'))

identity_owned = {'activity_log_id_seq', 'products_id_seq', 'sales_id_seq', 'usage_log_id_seq'}
late_checks = {'products.products_image_safe'}  # usan funciones: van después de crearlas

def sec(o):
    return [r for r in rows if r['ord'] == o]

parts = []
def h(title):
    parts.append(f"\n-- {'=' * 70}\n-- {title}\n-- {'=' * 70}\n")

parts.append("""-- Sunny POS — estructura completa de la base (sin datos).
-- Se corre UNA vez en un proyecto de Supabase nuevo y vacío, antes de 02_datos_iniciales.sql.
-- Generado del catálogo de la base piloto; no editar a mano: regenerar.
BEGIN;
SET LOCAL check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Toda función nueva nace sin EXECUTE para anon/PUBLIC: se da explícito al final.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
""")

h('Secuencias')
parts += [r['stmt'] for r in sec(10) if r['obj'] in identity_owned]
h('Tablas')
parts += [r['stmt'] + '\n' for r in sec(20)]
parts += [r['stmt'] for r in sec(25)]
h('Llaves, únicos y restricciones')
parts += [r['stmt'] for r in sec(30) if r['obj'] not in late_checks]
h('Relaciones entre tablas')
parts += [r['stmt'] for r in sec(40)]
h('Funciones')
# Funciones que mejoras.sql reescribe: se usa directo la versión nueva (la del
# piloto tenía datos del negocio, p. ej. la ubicación de la tienda)
MEJORAS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mejoras.sql'), encoding='utf-8').read()
def nueva(nombre):
    m = re.search(r'CREATE OR REPLACE FUNCTION public\.' + re.escape(nombre) + r'\(.*?\$\$;', MEJORAS, re.S)
    return m.group(0) if m else None
for r in sec(50):
    parts.append((nueva(r['obj'].split('(')[0]) or r['stmt']) + '\n')
h('Restricciones que usan funciones')
parts += [r['stmt'] for r in sec(30) if r['obj'] in late_checks]
h('Índices')
parts += [r['stmt'] for r in sec(60)]
h('Triggers')
parts += [r['stmt'] for r in sec(70)]
h('Seguridad por renglón (RLS)')
parts += [r['stmt'] for r in sec(80)]
parts += [r['stmt'] for r in sec(85)]
h('Permisos: se quita todo y se da solo lo necesario')
parts.append("""REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;""")
parts += [r['stmt'] for r in sec(90)]
parts += [r['stmt'] for r in sec(91)]
parts += [r['stmt'] for r in sec(95)]
h('Archivos (PDF de la revista)')
parts += [re.sub(r"VALUES \(('[^']*'), ('[^']*'), ([tf]),", lambda m: f"VALUES ({m[1]}, {m[2]}, {'true' if m[3]=='t' else 'false'},", r['stmt']) for r in sec(96)]
parts += [r['stmt'] for r in sec(97)]
h('Avisos en vivo: Caja e Inventario escuchan cambios de products')
parts.append("""DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;
""")
h('Mejoras sobre el modelo del piloto (scripts/instalar/mejoras.sql)')
parts.append(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mejoras.sql'), encoding='utf-8').read())
parts.append('COMMIT;')

text = '\n'.join(parts)
# Nada específico del negocio piloto debe quedar en la estructura
text = text.replace("'tresencantos.rpc_v2'", "'sunnypos.rpc_v2'").replace("'tresencantos:inventory'", "'sunnypos:inventory'")
text = text.replace('pide el PIN de Ofelia', 'pide el PIN a quien pueda autorizarlo')
left = re.findall(r'(?i)tres ?encantos|ofelia|areli|renata|maquixco|19\.6868|-98\.8904', text)
assert not left, left
open(out, 'w', encoding='utf-8', newline='\n').write(text)
print(len(text), 'bytes')
