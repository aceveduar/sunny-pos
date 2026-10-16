/* ── VARIANTES: tallas, colores, tamaños ─────────────────────────────────────
   Cada variante es un producto normal (su stock, precio y código de barras);
   las de una prenda comparten `variant_group`. Sin producto "padre": ventas,
   apartados, kits, escáner y reportes siguen igual. Nombre completo =
   "Blusa lino · M · Negro" (sale así en tickets y WhatsApp); `variant_base`
   guarda "Blusa lino" y `variant` [["Talla","M"],["Color","Negro"]] (lista: un
   objeto jsonb no respeta el orden y la talla debe ir primero).

   Aquí: crear una prenda con sus variantes (cuadrícula talla × color) y ver /
   editar las existencias de todo el grupo desde la ficha de una variante. */

// Opciones sugeridas según la categoría raíz (la dueña puede escribir otras)
const _VAR_PLANTILLAS = {
  ropa:      [['Talla', ['CH', 'M', 'G', 'EG']], ['Color', []]],
  calzado:   [['Número', ['22', '23', '24', '25', '26', '27']], ['Color', []]],
  bolsos:    [['Tamaño', ['Chico', 'Mediano', 'Grande']], ['Color', []]],
  belleza:   [['Presentación', ['30 ml', '50 ml', '100 ml']], ['Tono', []]],
  _default:  [['Talla', ['CH', 'M', 'G', 'EG']], ['Color', []]],
};
const _VAR_COLORES = ['Negro', 'Blanco', 'Beige', 'Rosa', 'Rojo', 'Azul', 'Verde', 'Gris', 'Café'];

let _var = null;  // estado de la ventana: { opciones: [[nombre, [valores]], …], stock: {clave: n}, imagen }

function _varRaiz(code) {
  let c = (categories || []).find(x => x.code === code);
  while (c?.parent) c = categories.find(x => x.code === c.parent) || null;
  return c?.code || code || '';
}
function _varPlantilla(code) {
  const t = _VAR_PLANTILLAS[_varRaiz(code)] || _VAR_PLANTILLAS._default;
  return t.map(([n, vals]) => [n, [...vals]]);
}
const _varClave = (a, b) => `${a}|${b ?? ''}`;

function openVariantBuilder() {
  if (!can.addProduct) { toast('Sin permiso para agregar productos', 'error'); return; }
  const cat = _lastNewProductCategory || '';
  _var = { opciones: _varPlantilla(cat), stock: {}, imagen: null };
  const $ = id => document.getElementById(id);
  $('var-name').value = ''; $('var-price').value = ''; $('var-cost').value = '';
  $('var-publish').checked = !!can.publishProduct;
  $('var-publish-row').style.display = can.publishProduct ? '' : 'none';
  _varLlenarCategorias(cat);
  _varQuitarFoto();
  _varPintar();
  $('var-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('var-name').focus(), 50);
}

async function closeVariantBuilder(forzar) {
  const hayDatos = document.getElementById('var-name').value.trim() || Object.values(_var?.stock || {}).some(n => n > 0);
  if (!forzar && hayDatos && !(await teConfirm({ title: 'Descartar', message: '¿Descartar esta prenda? Perderás lo que llevas capturado.', confirmText: 'Descartar', cancelText: 'Seguir aquí', danger: true }))) return;
  document.getElementById('var-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function _varLlenarCategorias(sel) {
  const s = document.getElementById('var-category');
  const raices = categories.filter(c => !c.parent && c.code !== 'por_revisar');
  s.innerHTML = '<option value="">Elige una categoría</option>' + raices.map(r => {
    const hijas = categories.filter(c => c.parent === r.code);
    return `<option value="${_esc(r.code)}">${_esc(r.label)}</option>` +
      hijas.map(h => `<option value="${_esc(h.code)}">&nbsp;&nbsp;${_esc(h.label)}</option>`).join('');
  }).join('');
  s.value = sel || '';
}

// Al cambiar de categoría, sugerir sus opciones (solo si no se ha capturado nada)
function _varCambioCategoria() {
  const code = document.getElementById('var-category').value;
  const capturado = Object.values(_var.stock).some(n => n > 0);
  if (!capturado) { _var.opciones = _varPlantilla(code); _varPintar(); }
}

function _varToggleValor(i, valor) {
  const vals = _var.opciones[i][1];
  const k = vals.indexOf(valor);
  if (k >= 0) vals.splice(k, 1); else vals.push(valor);
  _varPintar();
}
function _varAgregarValor(i, input) {
  const v = input.value.trim().replace(/\s+/g, ' ');
  if (!v) return;
  const vals = _var.opciones[i][1];
  if (!vals.some(x => x.toLowerCase() === v.toLowerCase())) vals.push(v.charAt(0).toUpperCase() + v.slice(1));
  input.value = '';
  _varPintar();
  document.getElementById(`var-add-${i}`)?.focus();
}
function _varNombreOpcion(i, input) {
  _var.opciones[i][0] = input.value.trim() || (i === 0 ? 'Talla' : 'Color');
  _varPintarCuadricula();
}

function _varPintar() {
  const sugeridas = i => i === 1 && /color|tono/i.test(_var.opciones[1][0]) ? _VAR_COLORES : (_varPlantilla(document.getElementById('var-category').value)[i]?.[1] || []);
  document.getElementById('var-opciones').innerHTML = _var.opciones.map(([nombre, vals], i) => {
    const todas = [...new Set([...sugeridas(i), ...vals])];
    return `<div class="var-opcion">
      <div class="var-opcion-head">
        <input type="text" class="var-opcion-nombre" value="${_esc(nombre)}" maxlength="20" aria-label="Nombre de la opción ${i + 1}" onchange="_varNombreOpcion(${i}, this)">
        <span class="var-opcion-hint">${i === 1 ? 'opcional' : ''}</span>
      </div>
      <div class="var-chips">
        ${todas.map(v => `<button type="button" class="var-chip${vals.includes(v) ? ' on' : ''}" aria-pressed="${vals.includes(v)}" onclick="_varToggleValor(${i}, '${_esc(v).replace(/'/g, "\\'")}')">${_esc(v)}</button>`).join('')}
        <input type="text" id="var-add-${i}" class="var-chip-input" placeholder="+ Otra" maxlength="20" onkeydown="if(event.key==='Enter'){event.preventDefault();_varAgregarValor(${i}, this)}" onblur="_varAgregarValor(${i}, this)">
      </div>
    </div>`;
  }).join('');
  _varPintarCuadricula();
}

function _varPintarCuadricula() {
  const [[n1, filas], [n2, cols]] = _var.opciones;
  const box = document.getElementById('var-grid');
  if (!filas.length) { box.innerHTML = `<p class="var-vacio">Elige al menos una ${_esc(n1.toLowerCase())}.</p>`; _varTotal(); return; }
  const columnas = cols.length ? cols : [null];
  box.innerHTML = `<table class="var-tabla">
    <thead><tr><th scope="col">${_esc(n1)}</th>${columnas.map(c => `<th scope="col">${c === null ? 'Piezas' : _esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr><th scope="row">${_esc(f)}</th>${columnas.map(c => {
      const k = _varClave(f, c);
      return `<td><input type="number" min="0" step="1" inputmode="numeric" class="var-celda" value="${_var.stock[k] || ''}" placeholder="0"
        aria-label="${_esc(f)}${c === null ? '' : ' ' + _esc(c)}" onfocus="this.select()" oninput="_var.stock['${_esc(k).replace(/'/g, "\\'")}'] = Math.max(0, parseInt(this.value) || 0); _varTotal()"></td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
  _varTotal();
}

function _varCombinaciones() {
  const [[n1, filas], [n2, cols]] = _var.opciones;
  const out = [];
  filas.forEach(f => (cols.length ? cols : [null]).forEach(c => {
    const variant = [[n1, f]]; if (c !== null) variant.push([n2, c]);
    out.push({ variant, etiqueta: c === null ? f : `${f} · ${c}`, stock: _var.stock[_varClave(f, c)] || 0 });
  }));
  return out;
}

function _varTotal() {
  const combos = _varCombinaciones();
  const piezas = combos.reduce((s, x) => s + x.stock, 0);
  document.getElementById('var-total').textContent = combos.length
    ? `${combos.length} variante${combos.length !== 1 ? 's' : ''} · ${piezas} pza${piezas !== 1 ? 's' : ''}` : '';
  const btn = document.getElementById('var-save');
  btn.textContent = combos.length ? `Crear ${combos.length} variante${combos.length !== 1 ? 's' : ''}` : 'Crear';
  btn.disabled = !combos.length;
}

/* Foto (opcional, la comparten todas las variantes) */
async function _varFoto(input) {
  const f = input.files?.[0]; if (!f) return;
  _var.imagen = await _fileToBase64Resized(f);
  const img = document.getElementById('var-foto-img');
  img.src = _var.imagen; img.hidden = false;
  document.getElementById('var-foto-ph').hidden = true;
  document.getElementById('var-foto-quitar').hidden = false;
}
function _varQuitarFoto() {
  if (_var) _var.imagen = null;
  document.getElementById('var-foto-img').hidden = true;
  document.getElementById('var-foto-ph').hidden = false;
  document.getElementById('var-foto-quitar').hidden = true;
  document.getElementById('var-foto-input').value = '';
}

async function saveVariantes() {
  const $ = id => document.getElementById(id);
  const base = $('var-name').value.trim().replace(/\s+/g, ' ');
  const price = parseFloat($('var-price').value);
  const costRaw = $('var-cost').value.trim();
  const cost = costRaw === '' ? null : parseFloat(costRaw);
  const catCode = $('var-category').value;
  if (!base) { toast('Escribe el nombre de la prenda', 'error'); $('var-name').focus(); return; }
  if (!catCode) { toast('Elige una categoría', 'error'); $('var-category').focus(); return; }
  if (isNaN(price) || price < 0) { toast('Escribe un precio válido', 'error'); $('var-price').focus(); return; }
  if (cost !== null && (isNaN(cost) || cost < 0)) { toast('El costo no es válido', 'error'); $('var-cost').focus(); return; }
  const combos = _varCombinaciones();
  if (!combos.length) return;

  const btn = $('var-save'); btn.disabled = true; btn.textContent = 'Guardando…';
  let imagen = DEFAULT_IMG;
  if (_var.imagen) imagen = (await uploadToDrive(_var.imagen)) || _var.imagen;
  const cat = categories.find(c => c.code === catCode);
  const grupo = crypto.randomUUID();
  const publicar = can.publishProduct && $('var-publish').checked;
  const posBase = products.length;
  const filas = combos.map((c, i) => ({
    name: `${base} · ${c.etiqueta}`, variant_base: base, variant: c.variant, variant_group: grupo,
    category: catCode, category_label: cat?.label || catCode, price, cost, description: '',
    image: imagen, images: null, stock: c.stock, is_published: publicar, featured: false,
    position: posBase + i, created_by: getCurrentUserEmail(),
  }));
  const r = await supabaseApi('products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(filas) });
  if (!r.ok || !Array.isArray(r.data)) {
    toast(`No se pudo guardar: ${r.data?.message || r.data?.hint || 'HTTP ' + r.status}`, 'error');
    btn.disabled = false; _varTotal(); return;
  }
  r.data.forEach(row => { products.push(mapProduct(row)); _trackEdit(row.id); });
  _lastNewProductCategory = catCode;
  const piezas = combos.reduce((s, x) => s + x.stock, 0);
  logActivity('producto_creado', `Creó "${base}" en ${combos.length} variantes (${piezas} pzas) — $${price.toLocaleString('es-MX')}`,
    { ids: r.data.map(x => x.id), name: base, price, variant_group: grupo });
  await closeVariantBuilder(true);
  renderTable(); renderStats();
  toast(`"${base}": ${combos.length} variantes creadas`, 'success');
}

/* ── Ficha (Quick View): existencias de todo el grupo ── */
// Valor de una opción ("Talla") en una variante [["Talla","M"],["Color","Negro"]]
const _varValor = (p, nombre) => (Array.isArray(p?.variant) ? p.variant : []).find(e => e[0] === nombre)?.[1];
function _varHermanas(p) {
  return p?.variantGroup ? products.filter(x => x.variantGroup === p.variantGroup && !x.isArchived) : [];
}

// Cuadrícula de existencias del grupo, con las celdas editables
function variantGridHTML(p) {
  const hs = _varHermanas(p);
  if (hs.length < 2 && !p?.variantGroup) return '';
  const nombres = (Array.isArray(hs[0]?.variant) ? hs[0].variant : []).map(e => e[0]);
  const [n1, n2] = nombres;
  const uniq = arr => [...new Set(arr)];
  const filas = uniq(hs.map(x => _varValor(x, n1)));
  const cols = n2 ? uniq(hs.map(x => _varValor(x, n2))) : [null];
  const celda = (f, c) => hs.find(x => _varValor(x, n1) === f && (c === null || _varValor(x, n2) === c));
  const total = hs.reduce((s, x) => s + (x.stock || 0), 0);
  return `<div class="var-qv">
    <div class="var-qv-head"><span>${_esc(nombres.join(' y '))}</span><span class="var-qv-total">${total} pza${total !== 1 ? 's' : ''} en ${hs.length} variantes</span></div>
    <div class="var-grid-wrap"><table class="var-tabla">
      <thead><tr><th scope="col">${_esc(n1)}</th>${cols.map(c => `<th scope="col">${c === null ? 'Piezas' : _esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr><th scope="row">${_esc(f)}</th>${cols.map(c => {
        const v = celda(f, c);
        if (!v) return '<td class="var-na">—</td>';
        return `<td class="${v.id === p.id ? 'var-actual' : ''}"><input type="number" min="0" step="1" inputmode="numeric" class="var-celda${v.stock === 0 ? ' var-cero' : ''}"
          value="${v.stock || 0}" data-id="${v.id}" aria-label="${_esc(v.name)}" onfocus="this.select()" onchange="_varGuardarStock(this)"></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="var-qv-hint">Toca un número para cambiar las piezas.</p>
  </div>`;
}

async function _varGuardarStock(input) {
  const id = +input.dataset.id;
  const p = products.find(x => x.id === id);
  const nuevo = Math.max(0, parseInt(input.value) || 0);
  if (!p || nuevo === p.stock) { input.value = p?.stock ?? 0; return; }
  if (!can.editProduct) { toast('Sin permiso para editar productos', 'error'); input.value = p.stock; return; }
  input.disabled = true;
  const r = await supabaseApi(`products?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ stock: nuevo }) });
  input.disabled = false;
  if (!r.ok || !r.data?.[0]) { toast('No se pudo guardar el stock', 'error'); input.value = p.stock; return; }
  const antes = p.stock;
  Object.assign(p, mapProduct(r.data[0]));
  input.classList.toggle('var-cero', p.stock === 0);
  _trackEdit(id);
  logActivity('producto_editado', `Cambió stock de "${p.name}": ${antes} → ${p.stock}`, { id, name: p.name, prevStock: antes, newStock: p.stock });
  const tot = document.querySelector('.var-qv-total');
  const hs = _varHermanas(p);
  if (tot) { const t = hs.reduce((s, x) => s + (x.stock || 0), 0); tot.textContent = `${t} pza${t !== 1 ? 's' : ''} en ${hs.length} variantes`; }
  renderTable(); renderStats();
}


/* ── Lista de Inventario: una prenda = un renglón ──
   La lista se filtra y ordena igual que siempre; al final, las variantes de
   una prenda que quedaron en la lista se juntan en un renglón en el lugar de
   la primera. Si el filtro deja una sola variante, se muestra esa variante
   (con su edición directa). El renglón agrupado no edita piezas ni precio
   directo (cambiaría una sola talla sin que se note): al tocarlo abre la ficha
   con la cuadrícula. Su casilla selecciona la prenda completa. */
function _agruparVariantes(list) {
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

function _grupoDatos(g) {
  const ms = g._grupo, f = ms[0], todas = _varHermanas(f);
  const piezas = ms.reduce((s, v) => s + (v.stock || 0), 0);
  const precios = ms.map(v => v.price || 0), pmin = Math.min(...precios), pmax = Math.max(...precios);
  const fmt = n => n.toLocaleString('es-MX');
  const pub = ms.filter(v => v.isPublished !== false).length;
  return {
    ms, f, piezas, nombre: f.variantBase || f.name,
    precio: pmin === pmax ? `$${fmt(pmin)}` : `$${fmt(pmin)}–${fmt(pmax)}`,
    resumen: ms.length < todas.length ? `${ms.length} de ${todas.length} variantes` : `${todas.length} variantes`,
    sel: todas.every(v => selectedIds.has(v.id)),
    chipStock: `<span class="stock-chip ${piezas === 0 ? 'stock-sold' : 'stock-ok'}" style="cursor:default">${piezas} pza${piezas !== 1 ? 's' : ''}</span>`,
    chipWeb: pub === 0
      ? `<span class="pub-toggle pub-hidden" style="cursor:default;pointer-events:none">${AR_ICO_EYEOFF(13)}<span class="pub-toggle-lbl">Oculto</span></span>`
      : `<span class="pub-toggle pub-visible" style="cursor:default;pointer-events:none">${AR_ICO_GLOBE(13)}<span class="pub-toggle-lbl">${pub < ms.length ? 'Web (algunas)' : 'Web'}</span></span>`,
  };
}

function _grupoSelect(id, checked) {
  const p = products.find(x => x.id === id);
  _varHermanas(p).forEach(v => { if (checked) selectedIds.add(v.id); else selectedIds.delete(v.id); });
  renderTable();
  updateBulkBar();
}

function variantGroupMobile(g) {
  const d = _grupoDatos(g);
  return `
<tr class="mpc-row${d.sel ? ' row-selected' : ''}" data-group="${_esc(g.variantGroup)}">
  <td><div class="mpc${d.piezas === 0 ? ' mpc-oos' : ''}">
    <div class="mpc-top" onclick="openQV(${d.f.id})" style="cursor:pointer">
      <div class="mpc-img-wrap">
        <img class="mpc-img" src="${_driveSz(d.f.image, 300)}" alt="${_esc(d.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'">
        <input type="checkbox" class="row-check mpc-check-over" aria-label="Seleccionar ${_esc(d.nombre)}" ${d.sel ? 'checked' : ''} onclick="event.stopPropagation()" onchange="_grupoSelect(${d.f.id}, this.checked)">
      </div>
      <div class="mpc-info">
        <div class="mpc-name">${_esc(d.nombre)}</div>
        <div class="mpc-cat-tag"><span class="cat-dot" style="background:${getCatColor(d.f.category)}"></span><span class="cat-label-inline" style="pointer-events:none">${_esc(_catDisplayLabel(d.f))}</span><span class="var-tag">${d.resumen}</span></div>
        <div class="mpc-price-row"><span class="mpc-price">${d.precio}</span>${d.chipStock}${d.chipWeb}</div>
      </div>
    </div>
  </div></td>
</tr>`;
}

function variantGroupRow(g) {
  const d = _grupoDatos(g);
  return `
<tr data-group="${_esc(g.variantGroup)}" class="${d.sel ? 'row-selected' : ''}" onclick="if(!event.target.closest('input'))openQV(${d.f.id})" style="cursor:pointer" title="Ver tallas y colores">
  <td class="col-check" style="text-align:center"><input type="checkbox" class="row-check" aria-label="Seleccionar ${_esc(d.nombre)}" ${d.sel ? 'checked' : ''} onchange="_grupoSelect(${d.f.id}, this.checked)"></td>
  <td class="col-product"><div style="display:flex;align-items:center;gap:10px;min-width:0">
    <img class="prod-thumb" src="${_driveSz(d.f.image, 80)}" alt="${_esc(d.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'">
    <div style="min-width:0;flex:1"><div class="prod-name">${_esc(d.nombre)}</div>
      <div class="prod-meta"><span class="cat-dot" style="background:${getCatColor(d.f.category)}"></span><span class="prod-meta-text">${_esc(_catDisplayLabel(d.f))}</span><span class="var-tag">${d.resumen}</span>${d.chipWeb}</div></div>
  </div></td>
  <td class="col-price"><div class="price-cell">${d.precio}</div></td>
  <td class="col-state"><div class="state-cell">${d.chipStock}</div></td>
</tr>`;
}

function variantGroupCard(g) {
  const d = _grupoDatos(g);
  return `
<div class="admin-card${d.sel ? ' card-selected' : ''}${d.piezas === 0 ? ' card-oos' : ''}" data-group="${_esc(g.variantGroup)}" onclick="if(!event.target.closest('input'))openQV(${d.f.id})" style="cursor:pointer">
  <div class="ac-img-wrap">
    <img class="ac-img" src="${_driveSz(d.f.image, 300)}" alt="${_esc(d.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'">
    <input type="checkbox" class="ac-check row-check" aria-label="Seleccionar ${_esc(d.nombre)}" ${d.sel ? 'checked' : ''} onchange="_grupoSelect(${d.f.id}, this.checked)">
  </div>
  <div class="ac-body">
    <div class="ac-name" title="${_esc(d.nombre)}">${_esc(d.nombre)}</div>
    <div class="ac-meta"><span class="var-tag">${d.resumen}</span></div>
    <div class="ac-price-row"><span class="ac-price">${d.precio}</span></div>
    <div class="ac-footer"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${d.chipStock}${d.chipWeb}</div></div>
  </div>
</div>`;
}
