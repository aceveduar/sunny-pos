/* ── ETIQUETAS PARA IMPRIMIR ─────────────────────────────────────────────────
   Nombre, talla/color, precio y código de barras. Dos formatos:
   - Hoja carta, 3 × 10 (etiqueta 66.7 × 25.4 mm, tipo Avery 5160) para
     cualquier impresora;
   - Rollo térmico 50 × 25 mm (una etiqueta por página).
   Cantidad: una por pieza en existencia o una de cada. Las barras se dibujan
   con JsBarcode (EAN-13 si el código es válido; si no, Code 128). Se imprime
   con window.print(): mientras dura, la página solo muestra #lbl-print. */

const _LBL_FORMATOS = {
  carta: { nombre: 'Hoja carta (30 por hoja)', page: 'size: letter; margin: 12.7mm 4.8mm 0 4.8mm' },
  rollo: { nombre: 'Rollo térmico 50 × 25 mm', page: 'size: 50mm 25mm; margin: 0' },
};
let _lbl = null;   // { ids }

function _loadJsBarcode() {
  return new Promise((resolve, reject) => {
    if (typeof JsBarcode !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
function _lblPref(k, v) {
  try { if (v === undefined) return localStorage.getItem('te_lbl_' + k); localStorage.setItem('te_lbl_' + k, v); } catch { return null; }
}

// Desde la ficha: una prenda imprime todas sus tallas/colores
function openLabelsFor(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  closeQV();  // la ficha va encima de las ventanas (igual que Editar)
  openLabels(p.variantGroup ? _varHermanas(p).map(x => x.id) : [id]);
}
function openLabels(ids) {
  const lista = (ids || [...selectedIds]).map(id => products.find(x => x.id === id)).filter(p => p && !Array.isArray(p.kitItems));
  if (!lista.length) { toast('Selecciona productos para imprimir etiquetas', ''); return; }
  _lbl = { ids: lista.map(p => p.id) };
  let ov = document.getElementById('lbl-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'lbl-overlay';
    ov.onclick = e => { if (e.target === ov) closeLabels(); };
    ov.innerHTML = `<div class="modal lbl-modal" role="dialog" aria-modal="true" aria-labelledby="lbl-title">
      <div class="modal-head"><h3 id="lbl-title">Imprimir etiquetas</h3>
        <button class="modal-close-btn" onclick="closeLabels()" aria-label="Cerrar">✕</button></div>
      <div class="modal-body">
        <p class="lbl-resumen" id="lbl-resumen"></p>
        <fieldset class="lbl-grupo"><legend>Cuántas</legend>
          <label class="lbl-op"><input type="radio" name="lbl-cant" value="stock" onchange="_lblPintar()"> Una por pieza en existencia</label>
          <label class="lbl-op"><input type="radio" name="lbl-cant" value="una" onchange="_lblPintar()"> Una de cada producto</label>
        </fieldset>
        <fieldset class="lbl-grupo"><legend>Papel</legend>
          ${Object.entries(_LBL_FORMATOS).map(([k, f]) => `<label class="lbl-op"><input type="radio" name="lbl-fmt" value="${k}" onchange="_lblPintar()"> ${f.nombre}</label>`).join('')}
        </fieldset>
        <div id="lbl-sincodigo"></div>
        <p class="lbl-sub">Vista previa</p>
        <div class="lbl-preview" id="lbl-preview"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="closeLabels()">Cancelar</button>
        <button class="btn btn-gold" id="lbl-print-btn" onclick="printLabels()">Imprimir</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
  }
  const cant = _lblPref('cant') || 'stock', fmt = _lblPref('fmt') || 'carta';
  ov.querySelector(`input[name=lbl-cant][value=${cant}]`).checked = true;
  ov.querySelector(`input[name=lbl-fmt][value=${_LBL_FORMATOS[fmt] ? fmt : 'carta'}]`).checked = true;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  _lblPintar();
}
function closeLabels() {
  document.getElementById('lbl-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function _lblOpciones() {
  const ov = document.getElementById('lbl-overlay');
  return { cant: ov.querySelector('input[name=lbl-cant]:checked')?.value || 'stock', fmt: ov.querySelector('input[name=lbl-fmt]:checked')?.value || 'carta' };
}
// Lista de etiquetas a imprimir (un producto repetido tantas veces como piezas)
function _lblEtiquetas() {
  const { cant } = _lblOpciones();
  const out = [];
  _lbl.ids.forEach(id => {
    const p = products.find(x => x.id === id); if (!p) return;
    const n = cant === 'una' ? 1 : Math.max(0, p.stock || 0);
    for (let i = 0; i < n; i++) out.push(p);
  });
  return out;
}

function _lblHTML(p) {
  const tieneVar = p.variantGroup && Array.isArray(p.variant) && p.variant.length;
  const nombre = tieneVar ? (p.variantBase || p.name) : p.name;
  const variante = tieneVar ? p.variant.map(e => e[1]).join(' · ') : '';
  const precio = '$' + (p.price || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return `<div class="lbl">
    <div class="lbl-nom">${_esc(nombre)}</div>
    <div class="lbl-fila">${variante ? `<span class="lbl-var">${_esc(variante)}</span>` : '<span></span>'}<span class="lbl-precio">${precio}</span></div>
    ${p.barcode ? `<svg class="lbl-bc" data-code="${_esc(p.barcode)}"></svg>` : '<div class="lbl-bc-vacio">Sin código</div>'}
  </div>`;
}
function _lblDibujarBarras(root) {
  if (typeof JsBarcode === 'undefined') return;
  root.querySelectorAll('svg.lbl-bc').forEach(svg => {
    const code = svg.dataset.code;
    const ean = /^\d{13}$/.test(code) && (() => {
      const s = [...code.slice(0, 12)].reduce((a, c, i) => a + (+c) * (i % 2 ? 3 : 1), 0);
      return (10 - s % 10) % 10 === +code[12];
    })();
    try {
      JsBarcode(svg, code, { format: ean ? 'EAN13' : 'CODE128', height: 34, width: ean ? 1.4 : 1.2, fontSize: 11, margin: 0, textMargin: 1, flat: true });
    } catch {
      svg.outerHTML = `<div class="lbl-bc-vacio">${_esc(code)}</div>`;
    }
  });
}

async function _lblPintar() {
  const { cant, fmt } = _lblOpciones();
  _lblPref('cant', cant); _lblPref('fmt', fmt);
  const prods = _lbl.ids.map(id => products.find(x => x.id === id)).filter(Boolean);
  const etiquetas = _lblEtiquetas();
  const hojas = fmt === 'carta' ? Math.ceil(etiquetas.length / 30) : 0;
  document.getElementById('lbl-resumen').textContent =
    `${prods.length} producto${prods.length !== 1 ? 's' : ''} · ${etiquetas.length} etiqueta${etiquetas.length !== 1 ? 's' : ''}` +
    (hojas ? ` · ${hojas} hoja${hojas !== 1 ? 's' : ''}` : '');
  const sin = prods.filter(p => !p.barcode);
  document.getElementById('lbl-sincodigo').innerHTML = sin.length
    ? `<div class="lbl-aviso">${sin.length === 1 ? '1 producto no tiene' : `${sin.length} productos no tienen`} código de barras: su etiqueta sale sin barras.
        ${can.editProduct ? `<button type="button" class="btn btn-outline btn-sm" onclick="_lblCrearCodigos()">Crear sus códigos</button>` : ''}</div>`
    : '';
  const btn = document.getElementById('lbl-print-btn');
  btn.disabled = !etiquetas.length;
  btn.textContent = etiquetas.length ? `Imprimir ${etiquetas.length}` : 'Imprimir';
  const prev = document.getElementById('lbl-preview');
  // Vista previa: una etiqueta de cada producto (máx. 6), al tamaño real
  prev.className = 'lbl-preview lbl-' + fmt;
  prev.innerHTML = etiquetas.length
    ? [...new Map(etiquetas.map(p => [p.id, p])).values()].slice(0, 6).map(_lblHTML).join('')
    : `<p class="lbl-vacio">Ninguno tiene piezas en existencia. Elige "Una de cada producto".</p>`;
  try { await _loadJsBarcode(); _lblDibujarBarras(prev); } catch { /* sin internet: salen sin barras */ }
}

async function _lblCrearCodigos() {
  const sin = _lbl.ids.map(id => products.find(x => x.id === id)).filter(p => p && !p.barcode);
  if (!sin.length) return;
  const ok = await teConfirm({
    title: 'Crear códigos',
    message: `Se crea un código de barras de la tienda para ${sin.length === 1 ? 'el producto' : `los ${sin.length} productos`} sin código. Úsalo si la mercancía no trae uno de fábrica.`,
    confirmText: 'Crear códigos',
  });
  if (!ok) return;
  let fallas = 0;
  for (const p of sin) {
    const r = await supabaseApi(`products?id=eq.${p.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ barcode: _varEan13() }) });
    if (r.ok && r.data?.[0]) Object.assign(p, mapProduct(r.data[0])); else fallas++;
  }
  logActivity('producto_editado', `Creó códigos de barras para ${sin.length - fallas} producto${sin.length - fallas !== 1 ? 's' : ''} (etiquetas)`, { ids: sin.map(p => p.id), changes: ['Código de barras'] });
  if (fallas) toast(`No se pudieron crear ${fallas} códigos`, 'error');
  renderTable();
  _lblPintar();
}

async function printLabels() {
  const { fmt } = _lblOpciones();
  const etiquetas = _lblEtiquetas();
  if (!etiquetas.length) return;
  if (etiquetas.length > 600 && !(await teConfirm({ title: 'Muchas etiquetas', message: `Son ${etiquetas.length} etiquetas. ¿Imprimirlas todas?`, confirmText: 'Imprimir' }))) return;
  try { await _loadJsBarcode(); } catch { toast('Sin conexión: las etiquetas salen sin barras', 'error'); }
  document.getElementById('lbl-print')?.remove();
  document.getElementById('lbl-page-style')?.remove();
  const box = document.createElement('div');
  box.id = 'lbl-print';
  box.className = 'lbl-' + fmt;
  box.innerHTML = etiquetas.map(_lblHTML).join('');
  document.body.appendChild(box);
  _lblDibujarBarras(box);
  const st = document.createElement('style');
  st.id = 'lbl-page-style';
  st.textContent = `@page { ${_LBL_FORMATOS[fmt].page} }`;
  document.head.appendChild(st);
  document.body.classList.add('lbl-imprimiendo');
  const fin = () => {
    document.body.classList.remove('lbl-imprimiendo');
    box.remove(); st.remove();
    window.removeEventListener('afterprint', fin);
  };
  window.addEventListener('afterprint', fin);
  logActivity('etiquetas_impresas', `Imprimió ${etiquetas.length} etiqueta${etiquetas.length !== 1 ? 's' : ''} de ${_lbl.ids.length} producto${_lbl.ids.length !== 1 ? 's' : ''}`, { ids: _lbl.ids, count: etiquetas.length, formato: fmt });
  setTimeout(() => window.print(), 50);
}
