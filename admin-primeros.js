/* ── PRIMEROS PASOS (guía de inicio para la dueña) ──────────────────────────
   Tarjeta arriba de la lista de Inventario, solo para quien administra
   (canManageSettings), hasta que se completan los pasos o se oculta.
   Cada paso se marca solo cuando ya se cumple (hay productos, hay otra
   cuenta, ya hubo una venta) o al tocarlo (revisar categorías, Ayuda,
   compartir la Tienda). Estado en config.primeros_pasos {hechos:[], oculto}.
   Patrón: guía de configuración de Shopify. */

let _pp = null;   // { hechos: Set, oculto, auto: {productos, equipo, venta} }

const _PP_PASOS = [
  { k: 'productos', titulo: 'Agrega tus productos', texto: 'Uno por uno, o todos de una vez desde Excel.',
    accion: () => (can.importExport ? openImport() : openForm()) },
  { k: 'categorias', titulo: 'Revisa tus categorías', texto: 'Que se llamen como en tu tienda.',
    accion: () => { _ppMarcar('categorias'); location.href = 'settings.html#catalogo'; } },
  { k: 'equipo', titulo: 'Crea las cuentas de tu equipo', texto: 'Cada quien entra con su correo y sus permisos.',
    accion: () => { location.href = 'settings.html#usuarios'; } },
  { k: 'venta', titulo: 'Haz tu primera venta en Caja', texto: 'Abre la caja con tu fondo y cobra.',
    accion: () => { location.href = 'pos.html'; } },
  { k: 'tienda', titulo: 'Comparte tu Tienda', texto: 'Manda el enlace por WhatsApp o ponlo en tus redes.', soloTienda: true,
    accion: () => _ppCompartirTienda() },
  { k: 'ayuda', titulo: 'Conoce la Ayuda', texto: 'Está en el menú de tu foto, arriba a la derecha.',
    accion: () => { _ppMarcar('ayuda'); window.openHelp?.(); } },
];

async function initPrimerosPasos() {
  if (!can.manageSettings) return;
  const [cfg, equipo, venta] = await Promise.all([
    supabaseApi('config?id=eq.primeros_pasos&select=value'),
    supabaseApi('config?id=eq.user_permissions&select=value'),
    supabaseApi('sales?select=id&limit=1'),
  ]);
  let guardado = {};
  try { guardado = JSON.parse(cfg.data?.[0]?.value || '{}') || {}; } catch { guardado = {}; }
  if (guardado.oculto) return;
  let personas = 0;
  try { personas = Object.keys(JSON.parse(equipo.data?.[0]?.value || '{}') || {}).length; } catch { /* sin dato */ }
  _pp = {
    hechos: new Set(Array.isArray(guardado.hechos) ? guardado.hechos : []),
    oculto: false,
    auto: { equipo: personas >= 2, venta: Array.isArray(venta.data) && venta.data.length > 0 },
  };
  renderPrimerosPasos();
}

function _ppPasos() {
  return _PP_PASOS.filter(p => !p.soloTienda || NEGOCIO.modulos?.tienda !== false);
}
function _ppHecho(k) {
  if (_pp.hechos.has(k)) return true;
  if (k === 'productos') return products.some(p => !p.isArchived);
  return !!_pp.auto[k];
}

function renderPrimerosPasos() {
  let box = document.getElementById('pp-card');
  if (!_pp || _pp.oculto) { box?.remove(); return; }
  const pasos = _ppPasos();
  const hechos = pasos.filter(p => _ppHecho(p.k)).length;
  if (hechos === pasos.length) { box?.remove(); return; }
  if (!box) {
    box = document.createElement('section');
    box.id = 'pp-card'; box.className = 'pp-card';
    box.setAttribute('aria-labelledby', 'pp-title');
    document.querySelector('main')?.prepend(box);
  }
  const ico = ok => ok
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-dasharray="3 3" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>';
  box.innerHTML = `
    <div class="pp-head">
      <div><h2 class="pp-title" id="pp-title">Primeros pasos</h2>
        <p class="pp-progreso">${hechos} de ${pasos.length} listos</p></div>
      <button type="button" class="pp-ocultar" onclick="_ppOcultar()">Ocultar</button>
    </div>
    <div class="pp-barra" aria-hidden="true"><div style="width:${Math.round(hechos / pasos.length * 100)}%"></div></div>
    <ol class="pp-lista">${pasos.filter(p => !_ppHecho(p.k)).map(p => {  // solo lo que falta: lo hecho ya cuenta arriba
      const ok = _ppHecho(p.k);
      return `<li><button type="button" class="pp-paso${ok ? ' hecho' : ''}" onclick="_ppIr('${p.k}')">
        <span class="pp-ico">${ico(ok)}</span>
        <span class="pp-txt"><span class="pp-t">${p.titulo}</span><span class="pp-d">${ok ? 'Listo' : p.texto}</span></span>
        <svg class="pp-flecha" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button></li>`;
    }).join('')}</ol>`;
}

function _ppIr(k) { _PP_PASOS.find(p => p.k === k)?.accion(); }

async function _ppGuardar() {
  await _saveConfigValue('primeros_pasos', JSON.stringify({ hechos: [..._pp.hechos], oculto: _pp.oculto }));
}
function _ppMarcar(k) {
  if (!_pp || _pp.hechos.has(k)) return;
  _pp.hechos.add(k);
  _ppGuardar();
  renderPrimerosPasos();
}
async function _ppOcultar() {
  const ok = await teConfirm({ title: 'Ocultar primeros pasos', message: 'La guía ya no aparecerá. Todo sigue en su lugar y la Ayuda tiene cada paso explicado.', confirmText: 'Ocultar' });
  if (!ok) return;
  _pp.oculto = true;
  await _ppGuardar();
  renderPrimerosPasos();
}

async function _ppCompartirTienda() {
  const url = new URL('index.html', location.href).href.replace(/index\.html$/, '');
  const texto = `Conoce ${NEGOCIO.nombre}: ${url}`;
  _ppMarcar('tienda');
  if (navigator.share) {
    try { await navigator.share({ title: NEGOCIO.nombre, text: texto, url }); } catch { /* cancelado */ }
    return;
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
}
