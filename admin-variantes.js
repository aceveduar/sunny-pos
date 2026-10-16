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
  // Abrir su ficha: ahí se ponen fotos por color y códigos de barras
  _varModo = 'piezas';
  openQV(r.data[0].id);
}

/* ── Ficha (Quick View): existencias de todo el grupo ── */
// Valor de una opción ("Talla") en una variante [["Talla","M"],["Color","Negro"]]
const _varValor = (p, nombre) => (Array.isArray(p?.variant) ? p.variant : []).find(e => e[0] === nombre)?.[1];
function _varHermanas(p) {
  return p?.variantGroup ? products.filter(x => x.variantGroup === p.variantGroup && !x.isArchived) : [];
}
// La opción que lleva foto propia (Color/Tono); -1 si la prenda no tiene
const _varOpcionFoto = nombres => nombres.findIndex(n => /color|tono/i.test(n || ''));
const _jsq = v => _esc(v).replace(/'/g, "\\'");

// Cuadrícula de existencias del grupo, con las celdas editables
function variantGridHTML(p) {
  const hs = _varHermanas(p);
  if (hs.length < 2 && !p?.variantGroup) return '';
  const nombres = (Array.isArray(hs[0]?.variant) ? hs[0].variant : []).map(e => e[0]);
  const [n1, n2] = nombres;
  const uniq = arr => _varOrden([...new Set(arr)]);
  const filas = uniq(hs.map(x => _varValor(x, n1)));
  const cols = n2 ? uniq(hs.map(x => _varValor(x, n2))) : [null];
  const celda = (f, c) => hs.find(x => _varValor(x, n1) === f && (c === null || _varValor(x, n2) === c));
  const total = hs.reduce((s, x) => s + (x.stock || 0), 0);
  // Foto por color: en el encabezado de cada color (columna, o renglón si es la única opción)
  const fi = can.editProduct && new Set(hs.map(x => _varValor(x, nombres[_varOpcionFoto(nombres)]))).size > 1 ? _varOpcionFoto(nombres) : -1;
  const foto = (i, val) => {
    if (fi !== i) return '';
    const v = hs.find(x => _varValor(x, nombres[i]) === val);
    return `<button type="button" class="var-fotocol" onclick="_varFotoColor(${p.id}, '${_jsq(nombres[i])}', '${_jsq(val)}')" aria-label="Cambiar foto de ${_esc(val)}" title="Foto de ${_esc(val)}">
      <img src="${_driveSz(v?.image || DEFAULT_IMG, 80)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'"></button>`;
  };
  const codigos = _varModo === 'codigos' && can.editProduct;
  const sinCodigo = hs.filter(x => !x.barcode).length;
  return `<div class="var-qv">
    <div class="var-qv-head"><span>${_esc(nombres.join(' y '))}</span><span class="var-qv-total">${total} pza${total !== 1 ? 's' : ''} en ${hs.length} variantes</span></div>
    ${can.editProduct ? `<div class="var-modo" role="group" aria-label="Qué ver en la cuadrícula">
      <button type="button" class="${codigos ? '' : 'on'}" aria-pressed="${!codigos}" onclick="_varCambiarModo('piezas')">Piezas</button>
      <button type="button" class="${codigos ? 'on' : ''}" aria-pressed="${codigos}" onclick="_varCambiarModo('codigos')">Códigos${sinCodigo ? ` <span class="var-modo-n">· ${sinCodigo} sin código</span>` : ''}</button>
    </div>` : ''}
    <div class="var-grid-wrap"><table class="var-tabla">
      <thead><tr><th scope="col">${_esc(n1)}</th>${cols.map(c => `<th scope="col">${c === null ? 'Piezas' : foto(1, c) + _esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr><th scope="row"><span class="var-fila">${foto(0, f)}${_esc(f)}</span></th>${cols.map(c => {
        const v = celda(f, c);
        if (!v) return can.addProduct
          ? `<td><button type="button" class="var-falta" onclick="_varCrearCombos(${p.id}, [[['${_jsq(n1)}', '${_jsq(f)}']${c === null ? '' : `, ['${_jsq(n2)}', '${_jsq(c)}']`}]])" aria-label="Agregar ${_esc(f)}${c === null ? '' : ' ' + _esc(c)}" title="Agregar esta combinación">+</button></td>`
          : '<td class="var-na">—</td>';
        if (codigos) return `<td class="${v.id === p.id ? 'var-actual' : ''}"><input type="text" inputmode="numeric" autocomplete="off" maxlength="40" class="var-celda var-codigo"
          value="${_esc(v.barcode || '')}" placeholder="—" data-id="${v.id}" aria-label="Código de ${_esc(v.name)}" onfocus="this.select()" onchange="_varGuardarCodigo(this)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_varSiguienteCelda(this)}"></td>`;
        return `<td class="${v.id === p.id ? 'var-actual' : ''}"><input type="number" min="0" step="1" inputmode="numeric" class="var-celda${v.stock === 0 ? ' var-cero' : ''}"
          value="${v.stock || 0}" data-id="${v.id}" aria-label="${_esc(v.name)}" onfocus="this.select()" onchange="_varGuardarStock(this)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_varSiguienteCelda(this)}"></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    ${codigos
      ? `<p class="var-qv-hint">Escanea o escribe el código de cada una; con Enter pasas a la siguiente.</p>
         ${sinCodigo ? `<button type="button" class="var-mas-btn var-generar" onclick="_varGenerarCodigos(${p.id})">Crear códigos para las ${sinCodigo} que no tienen</button>` : ''}`
      : `<p class="var-qv-hint">Toca un número para cambiar las piezas.${fi >= 0 ? ` Toca la foto de un ${_esc(nombres[fi].toLowerCase())} para cambiarla.` : ''}</p>`}
    ${can.addProduct ? `<div class="var-mas" id="var-mas">
      <button type="button" class="var-mas-btn" onclick="_varMostrarAgregar(true)">+ ${_esc(nombres.join(' o ').toLowerCase().replace(/^./, x => x.toUpperCase()))}</button>
      <div class="var-mas-form" hidden>
        ${nombres.length > 1 ? `<select id="var-mas-opcion" aria-label="Qué agregar">${nombres.map((n, i) => `<option value="${i}">${_esc(n)}</option>`).join('')}</select>` : ''}
        <input type="text" id="var-mas-valor" maxlength="20" placeholder="Ej: ${_esc(nombres.length > 1 ? 'Rojo' : (filas[0] || ''))}" aria-label="Nueva opción"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_varAgregarOpcion(${p.id})}else if(event.key==='Escape'){_varMostrarAgregar(false)}">
        <button type="button" class="btn btn-gold" onclick="_varAgregarOpcion(${p.id})">Agregar</button>
        <button type="button" class="btn btn-outline" onclick="_varMostrarAgregar(false)">Cancelar</button>
      </div>
    </div>` : ''}
  </div>`;
}

/* ── Códigos de barras por talla/color ── */
let _varModo = 'piezas';
function _varCambiarModo(m) {
  _varModo = m;
  const p = products.find(x => x.id === _qvCurrentId);
  const zona = document.getElementById('qv-var-zone');
  if (p && zona) zona.innerHTML = variantGridHTML(p);
  if (m === 'codigos') setTimeout(() => (zona?.querySelector('.var-codigo:placeholder-shown') || zona?.querySelector('.var-codigo'))?.focus(), 30);
}
// Enter = siguiente casilla (como en una hoja de cálculo; el lector de códigos manda Enter)
function _varSiguienteCelda(input) {
  const todas = [...input.closest('table').querySelectorAll('input.var-celda')];
  const sig = todas[todas.indexOf(input) + 1];
  if (sig) sig.focus(); else input.blur();
}

async function _varGuardarCodigo(input) {
  const id = +input.dataset.id;
  const p = products.find(x => x.id === id);
  const nuevo = input.value.trim().replace(/\s+/g, '') || null;
  if (!p || nuevo === (p.barcode || null)) { input.value = p?.barcode || ''; return; }
  if (!can.editProduct) { toast('Sin permiso para editar productos', 'error'); input.value = p.barcode || ''; return; }
  const otro = nuevo && products.find(x => x.id !== id && x.barcode === nuevo);
  if (otro) {
    toast(`Ese código ya lo usa "${otro.name}"`, 'error');
    input.value = p.barcode || ''; input.classList.add('var-error');
    setTimeout(() => { input.focus(); }, 60);
    setTimeout(() => input.classList.remove('var-error'), 2500);
    return;
  }
  input.disabled = true;
  const r = await supabaseApi(`products?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ barcode: nuevo }) });
  input.disabled = false;
  if (!r.ok || !r.data?.[0]) {
    toast(/duplicate|unique/i.test(r.data?.message || '') ? 'Ese código ya lo usa otro producto' : 'No se pudo guardar el código', 'error');
    input.value = p.barcode || ''; return;
  }
  const antes = p.barcode;
  Object.assign(p, mapProduct(r.data[0]));
  logActivity('producto_editado', `${antes ? 'Cambió' : 'Puso'} el código de barras de "${p.name}"`, { id, name: p.name, changes: ['Código de barras'] });
  const n = document.querySelector('.var-modo-n');
  const faltan = _varHermanas(p).filter(x => !x.barcode).length;
  if (n) { if (faltan) n.textContent = `· ${faltan} sin código`; else n.remove(); }
}

// Código interno EAN-13 (empieza con 2: rango de uso interno de la tienda, no
// choca con códigos de fábrica). Para la ropa que no trae código: se imprime en
// etiqueta y se escanea en Caja.
function _varEan13() {
  const usados = new Set(products.map(x => x.barcode).filter(Boolean));
  for (;;) {
    let d = '2' + String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    const suma = [...d].reduce((s, c, i) => s + (+c) * (i % 2 ? 3 : 1), 0);
    d += (10 - suma % 10) % 10;
    if (!usados.has(d)) return d;
  }
}
async function _varGenerarCodigos(pId) {
  const p = products.find(x => x.id === pId); if (!p) return;
  const faltan = _varHermanas(p).filter(x => !x.barcode);
  if (!faltan.length) return;
  const ok = await teConfirm({
    title: 'Crear códigos',
    message: `Se crea un código de barras de la tienda para cada una de las ${faltan.length} que no tienen. Sirve si la ropa no trae código: se imprime en etiqueta y se escanea en Caja.\n\nSi la mercancía ya trae su código, mejor escanéalo en cada casilla.`,
    confirmText: 'Crear códigos',
  });
  if (!ok) return;
  let fallas = 0;
  for (const v of faltan) {
    const r = await supabaseApi(`products?id=eq.${v.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ barcode: _varEan13() }) });
    if (r.ok && r.data?.[0]) Object.assign(v, mapProduct(r.data[0])); else fallas++;
  }
  const base = p.variantBase || p.name;
  logActivity('producto_editado', `Creó códigos de barras para ${faltan.length - fallas} variantes de "${base}"`, { ids: faltan.map(x => x.id), name: base, changes: ['Código de barras'] });
  _varRefrescarFicha();
  toast(fallas ? `No se pudieron crear ${fallas} códigos` : 'Códigos creados', fallas ? 'error' : 'success');
}

function _varRefrescarFicha() {
  const p = products.find(x => x.id === _qvCurrentId);
  if (p) _renderQV(p);
  renderTable(); renderStats();
}

function _varMostrarAgregar(abrir) {
  const box = document.getElementById('var-mas'); if (!box) return;
  box.querySelector('.var-mas-btn').hidden = abrir;
  box.querySelector('.var-mas-form').hidden = !abrir;
  if (abrir) document.getElementById('var-mas-valor')?.focus();
}

// "+ Talla o color": una talla nueva se crea en todos los colores (y al revés), con 0 piezas
function _varAgregarOpcion(pId) {
  const p = products.find(x => x.id === pId); if (!p) return;
  const hs = _varHermanas(p);
  const nombres = p.variant.map(e => e[0]);
  const i = +(document.getElementById('var-mas-opcion')?.value || 0);
  const raw = (document.getElementById('var-mas-valor')?.value || '').trim().replace(/\s+/g, ' ');
  if (!raw) { document.getElementById('var-mas-valor')?.focus(); return; }
  const valor = /^[a-zA-Z]{1,4}$/.test(raw) && i === 0 && !/color|tono/i.test(nombres[0]) ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1);
  const existentes = [...new Set(hs.map(x => _varValor(x, nombres[i])))];
  if (existentes.some(v => String(v).toLowerCase() === valor.toLowerCase())) { toast(`"${valor}" ya existe`, ''); return; }
  const otra = nombres.length > 1 ? 1 - i : -1;
  const combos = otra < 0 ? [[[nombres[0], valor]]]
    : _varOrden([...new Set(hs.map(x => _varValor(x, nombres[otra])))]).map(o => {
        const v = []; v[i] = [nombres[i], valor]; v[otra] = [nombres[otra], o]; return v;
      });
  _varCrearCombos(pId, combos);
}

// Crea variantes nuevas de la prenda copiando lo común de la que está abierta
async function _varCrearCombos(pId, combos) {
  if (!can.addProduct) { toast('Sin permiso para agregar productos', 'error'); return; }
  const p = products.find(x => x.id === pId); if (!p || !combos.length) return;
  const base = p.variantBase || p.name;
  const hs = _varHermanas(p);
  const fi = _varOpcionFoto(p.variant.map(e => e[0]));
  const filas = combos.map((variant, k) => {
    // Un color que ya existe usa su foto; uno nuevo, la de la variante abierta
    const mismoColor = fi >= 0 && hs.find(x => _varValor(x, variant[fi][0]) === variant[fi][1]);
    const fuente = mismoColor || p;
    return {
      name: `${base} · ${variant.map(e => e[1]).join(' · ')}`, variant_base: base, variant, variant_group: p.variantGroup,
      category: p.category, category_label: p.categoryLabel || p.category, price: p.price || 0, cost: p.cost ?? null,
      original_price: p.originalPrice || null, description: p.description || '',
      image: fuente.image || DEFAULT_IMG, images: fuente.images?.length ? fuente.images : null,
      badge: p.badge || null, badge_type: p.badgeType || null,
      stock: 0, is_published: can.publishProduct ? p.isPublished !== false : false, featured: false,
      position: products.length + k, created_by: getCurrentUserEmail(),
    };
  });
  const r = await supabaseApi('products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(filas) });
  if (!r.ok || !Array.isArray(r.data)) { toast(`No se pudo agregar: ${r.data?.message || 'HTTP ' + r.status}`, 'error'); return; }
  r.data.forEach(row => { products.push(mapProduct(row)); _trackEdit(row.id); });
  const etiquetas = combos.map(v => v.map(e => e[1]).join(' ')).join(', ');
  logActivity('producto_creado', `Agregó a "${base}": ${etiquetas}`, { ids: r.data.map(x => x.id), name: base, variant_group: p.variantGroup });
  _varRefrescarFicha();
  toast(combos.length === 1 ? `Agregada: ${etiquetas}. Escribe sus piezas.` : `${combos.length} variantes agregadas. Escribe sus piezas.`, 'success');
  setTimeout(() => document.querySelector(`.var-celda[data-id="${r.data[0].id}"]`)?.focus(), 80);
}

// Foto por color: cambia la foto principal de todas las variantes de ese color
function _varFotoColor(pId, opcion, valor) {
  if (!can.editProduct) { toast('Sin permiso para editar productos', 'error'); return; }
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files?.[0]; if (!f) return;
    const p = products.find(x => x.id === pId); if (!p) return;
    const ids = _varHermanas(p).filter(x => _varValor(x, opcion) === valor).map(x => x.id);
    const viejas = [...new Set(ids.map(id => products.find(x => x.id === id)?.image).filter(Boolean))];
    toast(`Subiendo foto de ${valor}…`, '');
    let url;
    try { const b64 = await _fileToBase64Resized(f); url = (await uploadToDrive(b64)) || b64; }
    catch { toast('No se pudo leer la foto', 'error'); return; }
    for (let k = 0; k < ids.length; k += 10) {
      const lote = ids.slice(k, k + 10);
      const r = await supabaseApi(`products?id=in.(${lote.join(',')})`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ image: url }) });
      if (!r.ok || !Array.isArray(r.data)) { toast('No se pudo guardar la foto', 'error'); return; }
      r.data.forEach(row => { const i = products.findIndex(x => x.id === row.id); if (i > -1) products[i] = { ...products[i], ...mapProduct(row) }; });
    }
    _varBorrarFotosSinUso(viejas);
    const base = p.variantBase || p.name;
    logActivity('producto_editado', `Cambió la foto de "${base}" en ${valor} (${ids.length} variante${ids.length !== 1 ? 's' : ''})`, { ids, name: base, changes: ['Imagen'] });
    _varRefrescarFicha();
    toast(`Foto de ${valor} actualizada`, 'success');
  };
  input.click();
}

// Borra de Drive las fotos que ya no usa ningún producto (las variantes comparten fotos)
function _varBorrarFotosSinUso(urls) {
  urls.forEach(url => {
    if (products.some(o => o.image === url || (o.images || []).includes(url))) return;
    const fid = _driveFileId(url);
    if (fid) _deleteDriveFile(fid);
  });
}

// Nombre escrito para una variante → { base, name } con su talla/color al final
// ("Blusa de lino" o "Blusa de lino · M · Negro" → base "Blusa de lino"). null si no es variante.
function _varNombre(p, escrito) {
  if (!p?.variantGroup || !Array.isArray(p.variant) || !p.variant.length || !escrito) return null;
  const suf = ' · ' + p.variant.map(e => e[1]).join(' · ');
  // Sin distinguir mayúsculas: el formulario pone mayúscula a cada palabra ("Ch · Azul Marino")
  const base = (escrito.toLowerCase().endsWith(suf.toLowerCase()) ? escrito.slice(0, -suf.length) : escrito).trim() || p.variantBase || escrito;
  return { base, name: base + suf };
}

// Al guardar una variante desde el formulario: ofrecer lo común a toda la prenda.
// Precio, costo, descripción, categoría, etiqueta, publicar y nombre van a todas;
// la foto solo a las del mismo color (así cada color conserva la suya).
// Piezas, código de barras, cód. proveedor y caducidad son de cada variante.
async function _varPropagarEdicion(prev, data) {
  const otras = _varHermanas(prev).filter(x => x.id !== prev.id);
  if (!otras.length) return;
  const comun = {}, cambios = [];
  const dif = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  if (dif(prev.price, data.price)) { comun.price = data.price; cambios.push('precio'); }
  if (dif(prev.originalPrice, data.originalPrice)) { comun.original_price = data.originalPrice; cambios.push('precio antes'); }
  if (dif(prev.cost, data.cost)) { comun.cost = data.cost; cambios.push('costo'); }
  if (dif(prev.description || '', data.description || '')) { comun.description = data.description; cambios.push('descripción'); }
  if (dif(prev.category, data.category)) { comun.category = data.category; comun.category_label = data.categoryLabel; cambios.push('categoría'); }
  if (dif(prev.badge, data.badge) || dif(prev.badgeType, data.badgeType)) { comun.badge = data.badge; comun.badge_type = data.badgeType; cambios.push('etiqueta'); }
  if ((prev.isPublished !== false) !== (data.isPublished !== false)) { comun.is_published = data.isPublished; cambios.push(data.isPublished ? 'publicar' : 'ocultar'); }
  const baseNueva = data.variantBase && dif(prev.variantBase, data.variantBase) ? data.variantBase : null;
  if (baseNueva) cambios.push('nombre');
  const fotoCambio = dif(prev.image, data.image) || dif(prev.images, data.images);
  const fi = _varOpcionFoto((prev.variant || []).map(e => e[0]));
  const colorOp = fi >= 0 ? prev.variant[fi] : null;
  const mismasFoto = fotoCambio ? otras.filter(x => !colorOp || _varValor(x, colorOp[0]) === colorOp[1]) : [];
  if (!cambios.length && !mismasFoto.length) return;

  const base = data.variantBase || prev.variantBase || prev.name;
  const lineas = [];
  const lista = cambios.length > 1 ? `${cambios.slice(0, -1).join(', ')} y ${cambios.at(-1)}` : cambios[0];
  if (cambios.length) lineas.push(`• ${lista.replace(/^./, x => x.toUpperCase())}: a las ${otras.length} variantes`);
  if (mismasFoto.length) lineas.push(`• Foto: ${colorOp ? `a las ${colorOp[1]} (${mismasFoto.length})` : `a las ${mismasFoto.length} variantes`}`);
  const ok = await teConfirm({
    title: 'Toda la prenda',
    message: `¿Aplicar también a las demás tallas y colores de "${base}"?\n${lineas.join('\n')}`,
    confirmText: 'Aplicar a todas', cancelText: 'Solo a esta',
  });
  if (!ok) return;

  const viejas = mismasFoto.flatMap(x => [x.image, ...(x.images || [])]).filter(Boolean);
  const porFila = otras.map(x => {
    const body = { ...comun };
    if (baseNueva) { body.variant_base = baseNueva; body.name = `${baseNueva} · ${(x.variant || []).map(e => e[1]).join(' · ')}`; }
    if (mismasFoto.includes(x)) { body.image = data.image; body.images = data.images; }
    return [x, body];
  }).filter(([, b]) => Object.keys(b).length);
  let fallas = 0;
  for (let k = 0; k < porFila.length; k += 8) {
    await Promise.all(porFila.slice(k, k + 8).map(async ([x, body]) => {
      const r = await supabaseApi(`products?id=eq.${x.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!r.ok || !r.data?.[0]) { fallas++; return; }
      const i = products.findIndex(o => o.id === x.id);
      if (i > -1) products[i] = { ...products[i], ...mapProduct(r.data[0]) };
      if (body.price !== undefined) _trackEdit(x.id);
    }));
  }
  _varBorrarFotosSinUso(viejas);
  const hechos = [...cambios, ...(mismasFoto.length ? ['foto'] : [])];
  logActivity('producto_editado', `Aplicó a ${porFila.length - fallas} variantes de "${base}": ${hechos.join(', ')}`,
    { ids: porFila.map(([x]) => x.id), name: base, variant_group: prev.variantGroup, changes: hechos });
  if (fallas) toast(`No se pudo actualizar ${fallas} variante${fallas !== 1 ? 's' : ''}; revisa tu conexión`, 'error');
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


/* ── Juntar productos sueltos en una prenda ──
   Para la tienda que ya tenía "Blusa lino M negra", "Blusa lino G negra"…
   capturadas por separado (o que suma un producto suelto a una prenda: se
   seleccionan la prenda y el suelto). Cada producto conserva su precio,
   piezas, código y fotos; solo se le pone su talla/color y el grupo. El
   sistema adivina el nombre común, la talla y el color; todo se puede corregir. */
const _VARJ_COLORES = ['azul marino', 'verde olivo', 'rosa palo', 'verde menta', 'azul cielo', 'azul rey', 'gris oxford', 'palo de rosa',
  'negro', 'negra', 'blanco', 'blanca', 'beige', 'rosa', 'rojo', 'roja', 'azul', 'verde', 'gris', 'café', 'cafe', 'camel', 'vino', 'nude',
  'dorado', 'dorada', 'plateado', 'plateada', 'morado', 'morada', 'lila', 'amarillo', 'amarilla', 'naranja', 'coral', 'crema', 'hueso',
  'marino', 'mostaza', 'terracota', 'turquesa', 'fucsia', 'menta', 'arena', 'chocolate', 'khaki', 'caqui', 'multicolor', 'estampado', 'estampada'];
const _VARJ_RELLENO = new Set(['talla', 'tall', 'num', 'num.', 'no', 'no.', 'número', 'numero', 'color', 'col', 'de', 'en', '-', '·', '/']);
let _varj = null;   // { ids, filas: [{id, v1, v2}] }

function _varjAdivinar(nombres) {
  const pal = nombres.map(n => n.split(/\s+|·/).map(w => w.trim()).filter(Boolean));
  // Nombre común = palabras iguales al inicio de todos
  let k = 0;
  while (pal.every(ws => ws[k] && ws[k].toLowerCase() === pal[0][k].toLowerCase())) k++;
  const base = pal[0].slice(0, k).join(' ').replace(/[\s·-]+$/, '');
  const restos = pal.map(ws => ws.slice(k).filter(w => !_VARJ_RELLENO.has(w.toLowerCase())));
  const filas = restos.map(ws => {
    let talla = '', color = '';
    const libres = [];
    let txt = ' ' + ws.join(' ').toLowerCase() + ' ';
    const c = _VARJ_COLORES.find(col => txt.includes(' ' + col + ' '));
    if (c) { color = c; txt = txt.replace(' ' + c + ' ', ' '); }
    txt.trim().split(/\s+/).filter(Boolean).forEach(w => {
      const W = w.toUpperCase().replace(/^#/, '');
      if (!talla && (_VAR_TALLAS.includes(W) || /^\d{1,2}([.,]5)?$/.test(W))) talla = W;
      else libres.push(w);
    });
    if (!color && libres.length) color = libres.join(' ');
    const may = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    return { talla, color: may(color) };
  });
  const hayTalla = filas.some(f => f.talla), hayColor = filas.some(f => f.color);
  const numerica = filas.filter(f => f.talla).every(f => /^\d/.test(f.talla));
  if (hayTalla) return { base, n1: numerica ? 'Número' : 'Talla', n2: hayColor ? 'Color' : '', vals: filas.map(f => [f.talla, f.color]) };
  return { base, n1: 'Color', n2: '', vals: filas.map(f => [f.color, '']) };
}

function openVariantJoin() {
  if (!can.editProduct) { toast('Sin permiso para editar productos', 'error'); return; }
  const sel = [...selectedIds].map(id => products.find(x => x.id === id)).filter(Boolean);
  const kits = sel.filter(p => Array.isArray(p.kitItems));
  if (kits.length) { toast('Los kits no se pueden juntar como tallas o colores', 'error'); return; }
  if (sel.length < 2) { toast('Selecciona al menos 2 productos', ''); return; }
  if (sel.length > 120) { toast('Son demasiados: junta una prenda a la vez', 'error'); return; }
  // Los que ya son variantes dan su nombre y sus valores tal cual
  const conVar = sel.find(p => p.variantGroup && Array.isArray(p.variant) && p.variant.length);
  const adiv = _varjAdivinar(sel.map(p => p.variantGroup ? (p.variantBase || p.name) + ' ' + (p.variant || []).map(e => e[1]).join(' ') : p.name));
  const n1 = conVar ? conVar.variant[0][0] : adiv.n1;
  const n2 = conVar ? (conVar.variant[1]?.[0] || '') : adiv.n2;
  _varj = {
    ids: sel.map(p => p.id),
    filas: sel.map((p, i) => {
      if (p.variantGroup && Array.isArray(p.variant)) return { id: p.id, v1: _varValor(p, n1) || '', v2: n2 ? (_varValor(p, n2) || '') : '' };
      return { id: p.id, v1: adiv.vals[i][0], v2: n2 ? adiv.vals[i][1] : '' };
    }),
  };
  const $ = id => document.getElementById(id);
  $('varj-name').value = conVar ? (conVar.variantBase || '') : adiv.base;
  $('varj-n1').value = n1; $('varj-n2').value = n2;
  _varjPintar();
  $('varj-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeVariantJoin() {
  document.getElementById('varj-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function _varjPintar() {
  const n1 = document.getElementById('varj-n1').value.trim() || 'Talla';
  const n2 = document.getElementById('varj-n2').value.trim();
  document.getElementById('varj-lista').innerHTML = `<table class="varj-tabla">
    <thead><tr><th scope="col">Producto</th><th scope="col">${_esc(n1)}</th>${n2 ? `<th scope="col">${_esc(n2)}</th>` : ''}</tr></thead>
    <tbody>${_varj.filas.map((f, i) => {
      const p = products.find(x => x.id === f.id);
      return `<tr>
        <td class="varj-prod"><img src="${_driveSz(p.image || DEFAULT_IMG, 80)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'"><span>${_esc(p.name)}</span></td>
        <td><input type="text" class="varj-val" maxlength="20" value="${_esc(f.v1)}" aria-label="${_esc(n1)} de ${_esc(p.name)}" oninput="_varj.filas[${i}].v1=this.value"></td>
        ${n2 ? `<td><input type="text" class="varj-val" maxlength="20" value="${_esc(f.v2)}" aria-label="${_esc(n2)} de ${_esc(p.name)}" oninput="_varj.filas[${i}].v2=this.value"></td>` : ''}
      </tr>`;
    }).join('')}</tbody></table>`;
  document.getElementById('varj-save').textContent = `Juntar ${_varj.filas.length} productos`;
}

async function saveVariantJoin() {
  const $ = id => document.getElementById(id);
  applyTitleCase('varj-name');
  const base = $('varj-name').value.trim().replace(/\s+/g, ' ');
  const n1 = $('varj-n1').value.trim(), n2 = $('varj-n2').value.trim();
  const limpio = v => String(v || '').trim().replace(/\s+/g, ' ');
  if (!base) { toast('Escribe el nombre de la prenda', 'error'); $('varj-name').focus(); return; }
  if (!n1) { toast('Escribe qué cambia entre ellos (por ejemplo Talla)', 'error'); $('varj-n1').focus(); return; }
  const filas = _varj.filas.map(f => ({ id: f.id, v1: limpio(f.v1), v2: n2 ? limpio(f.v2) : '' }));
  const sin1 = filas.findIndex(f => !f.v1);
  if (sin1 >= 0) { toast(`Falta la ${n1.toLowerCase()} de "${products.find(x => x.id === filas[sin1].id)?.name}"`, 'error'); document.querySelectorAll('.varj-tabla tbody tr')[sin1]?.querySelector('input')?.focus(); return; }
  if (n2 && filas.some(f => f.v2) && filas.some(f => !f.v2)) { toast(`Escribe el ${n2.toLowerCase()} de todos, o deja la columna vacía`, 'error'); return; }
  const usaN2 = n2 && filas.some(f => f.v2);
  const vistos = new Map();
  for (const f of filas) {
    const k = (f.v1 + '|' + (usaN2 ? f.v2 : '')).toLowerCase();
    if (vistos.has(k)) { toast(`Dos productos quedarían como "${f.v1}${usaN2 ? ' · ' + f.v2 : ''}"`, 'error'); return; }
    vistos.set(k, f.id);
  }
  const btn = $('varj-save'); btn.disabled = true; btn.textContent = 'Guardando…';
  const grupo = crypto.randomUUID();
  let fallas = 0;
  for (let k = 0; k < filas.length; k += 8) {
    await Promise.all(filas.slice(k, k + 8).map(async f => {
      const variant = [[n1, f.v1]]; if (usaN2) variant.push([n2, f.v2]);
      const body = { variant_group: grupo, variant, variant_base: base, name: `${base} · ${variant.map(e => e[1]).join(' · ')}` };
      const r = await supabaseApi(`products?id=eq.${f.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!r.ok || !r.data?.[0]) { fallas++; return; }
      const i = products.findIndex(x => x.id === f.id);
      if (i > -1) products[i] = { ...products[i], ...mapProduct(r.data[0]) };
    }));
  }
  btn.disabled = false;
  logActivity('producto_editado', `Juntó ${filas.length - fallas} productos en la prenda "${base}"`, { ids: filas.map(f => f.id), name: base, variant_group: grupo, changes: ['Tallas y colores'] });
  if (fallas) { toast(`No se pudieron juntar ${fallas}; revisa tu conexión y vuelve a intentarlo`, 'error'); _varjPintar(); return; }
  closeVariantJoin();
  selectedIds.clear(); updateBulkBar(); renderTable(); renderStats();
  toast(`"${base}": ${filas.length} productos juntos`, 'success');
  _varModo = 'piezas';
  openQV(filas[0].id);
}

// Ficha → Más → "Quitar de la prenda": vuelve a ser un producto suelto (conserva su nombre completo)
async function _varSeparar(id) {
  const p = products.find(x => x.id === id); if (!p?.variantGroup) return;
  if (!can.editProduct) { toast('Sin permiso para editar productos', 'error'); return; }
  const ok = await teConfirm({ title: 'Quitar de la prenda', message: `"${p.name}" quedará como un producto suelto, con el mismo nombre, precio y piezas.\nLas demás tallas y colores no cambian.`, confirmText: 'Quitar' });
  if (!ok) return;
  const r = await supabaseApi(`products?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ variant_group: null, variant: null, variant_base: null }) });
  if (!r.ok || !r.data?.[0]) { toast('No se pudo quitar', 'error'); return; }
  const base = p.variantBase || p.name;
  Object.assign(p, mapProduct(r.data[0]));
  logActivity('producto_editado', `Quitó "${p.name}" de la prenda "${base}"`, { id, name: p.name, changes: ['Tallas y colores'] });
  _varRefrescarFicha();
  toast('Ahora es un producto suelto', 'success');
}
