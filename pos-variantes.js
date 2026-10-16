/* ── CAJA: prendas con tallas y colores ──────────────────────────────────────
   En la lista, las variantes de una prenda se juntan en una tarjeta (si hay
   2 o más en lo que se ve); al tocarla se abre la cuadrícula talla × color con
   las piezas de cada una y se toca la que se lleva la clienta (patrón Shopify
   POS). Una búsqueda que deja una sola variante ("lino m negro") y el escáner
   siguen agregando la variante exacta. */

const _posVarValor = (p, n) => (Array.isArray(p?.variant) ? p.variant : []).find(e => e[0] === n)?.[1];

function _posAgrupar(list) {
  if (!list.some(p => p.variantGroup)) return list;
  const grupos = new Map();
  list.forEach(p => { if (p.variantGroup) (grupos.get(p.variantGroup) || grupos.set(p.variantGroup, []).get(p.variantGroup)).push(p); });
  const out = [], hechos = new Set();
  list.forEach(p => {
    if (!p.variantGroup) { out.push(p); return; }
    if (hechos.has(p.variantGroup)) return;
    hechos.add(p.variantGroup);
    const ms = grupos.get(p.variantGroup);
    out.push(ms.length === 1 ? p : { _grupo: ms, id: ms[0].id, variantGroup: p.variantGroup });
  });
  return out;
}

// Todas las variantes de la prenda (también las agotadas, que la lista esconde)
const _posHermanas = g => products.filter(x => x.variantGroup === g);

function _posGrupoDatos(g) {
  const todas = _posHermanas(g.variantGroup);
  const f = todas[0] || g._grupo[0];
  const libres = todas.filter(v => (v.stock || 0) > 0 && !v.outOfStock);
  const piezas = libres.reduce((s, v) => s + (v.stock || 0), 0);
  const precios = todas.map(v => v.price || 0), pmin = Math.min(...precios), pmax = Math.max(...precios);
  const nombres = (f.variant || []).map(e => e[0]);
  const resumen = nombres.map(n => {
    const k = new Set(todas.map(v => _posVarValor(v, n))).size;
    const nom = n.toLowerCase();
    return `${k} ${k === 1 ? nom : (/[aeiou]$/.test(nom) ? nom + 's' : nom + 'es')}`;
  }).join(' · ');
  return {
    f, todas, piezas, resumen, nombre: f.variantBase || f.name,
    precio: pmin === pmax ? `$${pmin.toLocaleString('es-MX')}` : `$${pmin.toLocaleString('es-MX')}–${pmax.toLocaleString('es-MX')}`,
  };
}

function posGarmentRow(g) {
  const d = _posGrupoDatos(g);
  return `
<div class="pos-prod${d.piezas ? '' : ' pos-prod-oos'}" onclick="openPosVarPicker('${_esc(g.variantGroup)}')">
  <img class="pos-prod-img" src="${_driveSz(d.f.image, 200)}" alt="${_esc(d.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${PROD_PLACEHOLDER}'">
  <div class="pos-prod-info">
    <div class="pos-prod-name">${_esc(d.nombre)}</div>
    <div class="pos-prod-sub">${_esc(d.f.categoryLabel || '')} · ${d.resumen} · ${d.piezas ? `${d.piezas} pza${d.piezas !== 1 ? 's' : ''}` : '<span style="color:var(--red)">Sin stock</span>'}</div>
  </div>
  <div class="pos-prod-right">
    <div class="pos-prod-price">${d.precio}</div>
    <button class="pos-prod-add" onclick="event.stopPropagation();openPosVarPicker('${_esc(g.variantGroup)}')" title="Elegir talla o color" aria-label="Elegir talla o color de ${_esc(d.nombre)}">+</button>
  </div>
</div>`;
}

function posGarmentCard(g) {
  const d = _posGrupoDatos(g);
  return `
<div class="pos-card${d.piezas ? '' : ' card-sold'}" onclick="openPosVarPicker('${_esc(g.variantGroup)}')">
  <div class="pos-card-img-wrap">
    <img class="pos-card-img" src="${_driveSz(d.f.image, 200)}" alt="${_esc(d.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${PROD_PLACEHOLDER}'">
    <div class="pos-card-add"><div class="pos-card-add-icon">+</div></div>
  </div>
  <div class="pos-card-body">
    <div class="pos-card-name">${_esc(d.nombre)}</div>
    <div class="pos-card-var">${d.resumen}</div>
    <div class="pos-card-price">${d.precio}</div>
    <span class="pos-card-stock ${d.piezas ? 'stock-ok' : 'stock-sold'}">${d.piezas ? `${d.piezas} pza${d.piezas !== 1 ? 's' : ''}` : 'Sin stock'}</span>
  </div>
</div>`;
}

/* Cuadrícula talla × color: tocar una casilla agrega esa variante */
function openPosVarPicker(grupo) {
  const todas = _posHermanas(grupo);
  if (!todas.length) return;
  const d = _posGrupoDatos({ variantGroup: grupo, _grupo: todas });
  const nombres = (d.f.variant || []).map(e => e[0]);
  const [n1, n2] = nombres;
  const filas = _varOrden([...new Set(todas.map(v => _posVarValor(v, n1)))]);
  const cols = n2 ? _varOrden([...new Set(todas.map(v => _posVarValor(v, n2)))]) : [null];
  const celda = (f, c) => todas.find(v => _posVarValor(v, n1) === f && (c === null || _posVarValor(v, n2) === c));
  let ov = document.getElementById('pos-var-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pos-var-overlay'; ov.className = 'pos-var-overlay';
    ov.onclick = e => { if (e.target === ov) closePosVarPicker(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="pos-var-sheet" role="dialog" aria-modal="true" aria-labelledby="pos-var-title">
    <div class="pos-var-head">
      <img src="${_driveSz(d.f.image, 120)}" alt="" onerror="this.onerror=null;this.src='${PROD_PLACEHOLDER}'">
      <div class="pos-var-tit"><h3 id="pos-var-title">${_esc(d.nombre)}</h3><span>${d.precio} · ${d.piezas} pza${d.piezas !== 1 ? 's' : ''}</span></div>
      <button type="button" class="pos-var-close" onclick="closePosVarPicker()" aria-label="Cerrar">✕</button>
    </div>
    <p class="pos-var-hint">Toca la ${_esc(nombres.join(' y ').toLowerCase())} que se lleva</p>
    <div class="pos-var-grid-wrap"><table class="pos-var-tabla">
      <thead><tr><th scope="col">${_esc(n1)}</th>${cols.map(c => `<th scope="col">${c === null ? 'Piezas' : _esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr><th scope="row">${_esc(f)}</th>${cols.map(c => {
        const v = celda(f, c);
        if (!v) return '<td class="pos-var-na">—</td>';
        const st = v.outOfStock ? 0 : (v.stock || 0);
        const etq = `${f}${c === null ? '' : ' ' + c}`;
        return `<td><button type="button" class="pos-var-btn${st ? '' : ' agotada'}" onclick="_posVarElegir(${v.id})"
          aria-label="${_esc(etq)}: ${st ? `${st} pieza${st !== 1 ? 's' : ''}` : 'agotada'}">${st || '0'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="pos-var-pie">El número es cuántas piezas hay. En 0, tócala para reabastecer.</p>
  </div>`;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePosVarPicker() {
  document.getElementById('pos-var-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
function _posVarElegir(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  closePosVarPicker();
  if (p.outOfStock || !(p.stock > 0)) {
    if (typeof _showRestock !== 'undefined' && _showRestock) _showRestockPrompt(id);
    else toast(`${p.name}: agotada`, 'error');
    return;
  }
  addToCart(id, null, null);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('pos-var-overlay')?.classList.contains('open')) closePosVarPicker();
});
