/* ── IMPORTAR PRODUCTOS DESDE EXCEL O CSV ────────────────────────────────────
   Para la tienda que llega con su lista en Excel. Lee la primera hoja con
   SheetJS, adivina qué columna es cada dato (todo se puede corregir), muestra
   cómo quedará y crea los productos en lotes. Con columnas Talla/Color, los
   renglones con el mismo nombre se juntan en una prenda (variantes).
   Un código de barras que ya existe se salta o actualiza precio/costo/piezas.
   Lo que no tiene categoría reconocida queda en "Por revisar" (Pendientes). */

const _IMP_CAMPOS = [
  { k: 'name',     label: 'Nombre',            req: true, sin: ['nombre', 'producto', 'nombre del producto', 'articulo', 'item', 'name', 'descripcion corta'] },
  { k: 'price',    label: 'Precio de venta',   req: true, sin: ['precio', 'precio de venta', 'precio venta', 'pvp', 'venta', 'price', 'precio publico'] },
  { k: 'cost',     label: 'Costo',             sin: ['costo', 'precio de compra', 'precio compra', 'costo unitario', 'cost', 'compra'] },
  { k: 'stock',    label: 'Piezas',            sin: ['piezas', 'existencia', 'existencias', 'stock', 'cantidad', 'inventario', 'qty', 'pzas'] },
  { k: 'barcode',  label: 'Código de barras',  sin: ['codigo de barras', 'codigo barras', 'ean', 'upc', 'barcode', 'codigo', 'sku'] },
  { k: 'category', label: 'Categoría',         sin: ['categoria', 'departamento', 'linea', 'familia', 'category', 'tipo'] },
  { k: 'description', label: 'Descripción',    sin: ['descripcion', 'detalle', 'description', 'detalles'] },
  { k: 'talla',    label: 'Talla o número',    sin: ['talla', 'numero', 'size', 'tamano', 'medida'] },
  { k: 'color',    label: 'Color',             sin: ['color', 'tono', 'colour'] },
  { k: 'supplier_code', label: 'Código del proveedor', sin: ['codigo proveedor', 'codigo de proveedor', 'clave proveedor', 'clave', 'referencia', 'ref', 'modelo'] },
];
let _imp = null;   // { nombreArchivo, cols: [encabezados], filas: [[…]], map: {campo: índiceColumna|-1}, existe, publicar }

const _impNorm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function _impNum(v) {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').replace(/[$\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function _loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (typeof XLSX !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function openImport() {
  if (!can.addProduct || !can.importExport) { toast('Sin permiso para importar productos', 'error'); return; }
  _imp = null;
  let ov = document.getElementById('imp-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'imp-overlay';
    ov.onclick = e => { if (e.target === ov) closeImport(); };
    ov.innerHTML = `<div class="modal imp-modal" role="dialog" aria-modal="true" aria-labelledby="imp-title">
      <div class="modal-head"><h3 id="imp-title">Importar desde Excel</h3>
        <button class="modal-close-btn" onclick="closeImport()" aria-label="Cerrar">✕</button></div>
      <div class="modal-body" id="imp-body"></div>
      <div class="modal-foot" id="imp-foot"></div>
    </div>`;
    document.body.appendChild(ov);
  }
  _impPaso1();
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeImport() {
  document.getElementById('imp-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function _impPaso1(error) {
  document.getElementById('imp-body').innerHTML = `
    <p class="imp-txt">Sube tu lista de productos en Excel (.xlsx) o CSV. La primera fila debe tener los títulos de las columnas (Nombre, Precio, Piezas…); el sistema reconoce cada columna y te deja revisar antes de guardar.</p>
    ${error ? `<div class="imp-error">${_esc(error)}</div>` : ''}
    <label class="imp-elegir">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>
      Elegir archivo
      <input type="file" accept=".xlsx,.xls,.csv,.txt" hidden onchange="_impLeer(this)">
    </label>
    <button type="button" class="imp-plantilla" onclick="_impPlantilla()">¿No tienes lista? Descarga la plantilla</button>`;
  document.getElementById('imp-foot').innerHTML = `<button class="btn btn-outline" onclick="closeImport()">Cancelar</button>`;
}

function _impPlantilla() {
  const cols = ['Nombre', 'Precio', 'Costo', 'Piezas', 'Código de barras', 'Categoría', 'Descripción', 'Talla', 'Color', 'Código del proveedor'];
  const ej = [
    ['Blusa de lino', '399', '180', '2', '', 'Ropa', 'Fresca y cómoda', 'M', 'Negro', ''],
    ['Blusa de lino', '399', '180', '1', '', 'Ropa', 'Fresca y cómoda', 'G', 'Negro', ''],
    ['Bolso tote', '650', '300', '3', '7501234567890', 'Bolsos', '', '', '', 'BT-01'],
  ];
  const csv = '﻿' + [cols, ...ej].map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'plantilla-productos.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function _impLeer(input) {
  const f = input.files?.[0]; if (!f) return;
  document.getElementById('imp-body').innerHTML = '<p class="imp-txt">Leyendo el archivo…</p>';
  try {
    await _loadSheetJS();
    const buf = await f.arrayBuffer();
    let wb;
    if (/\.(csv|txt)$/i.test(f.name)) {
      // CSV de Excel en Windows suele venir en Windows-1252: probar UTF-8 primero
      let txt;
      try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { txt = new TextDecoder('windows-1252').decode(buf); }
      wb = XLSX.read(txt.replace(/^﻿/, ''), { type: 'string', raw: true });
    } else {
      wb = XLSX.read(buf, { type: 'array' });
    }
    const hoja = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '', blankrows: false });
    // Encabezados = primera fila (de las 10 primeras) con 2+ textos
    const h = filas.slice(0, 10).findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 2);
    if (h < 0) throw new Error('No encontré la fila de títulos (Nombre, Precio…). Revisa que la primera fila los tenga.');
    const cols = filas[h].map((c, i) => String(c).trim() || `Columna ${i + 1}`);
    const datos = filas.slice(h + 1).filter(r => r.some(c => String(c).trim()));
    if (!datos.length) throw new Error('El archivo no tiene productos debajo de los títulos.');
    if (datos.length > 5000) throw new Error(`Son ${datos.length} renglones; importa hasta 5,000 a la vez (divide el archivo).`);
    _imp = { nombreArchivo: f.name, hoja: /\.(csv|txt)$/i.test(f.name) ? '' : wb.SheetNames[0], cols, filas: datos, map: _impAdivinar(cols), existe: 'saltar', publicar: false };
    _impPaso2();
  } catch (e) {
    _impPaso1(e?.message?.startsWith('No ') || e?.message?.startsWith('El ') || e?.message?.startsWith('Son ') ? e.message : 'No se pudo leer el archivo. Guárdalo como Excel (.xlsx) o CSV e inténtalo de nuevo.');
  }
}

function _impAdivinar(cols) {
  const n = cols.map(_impNorm), map = {}, usadas = new Set();
  // Primero coincidencias exactas, luego "contiene" (para no robarle "Código" a "Código de barras")
  for (const exacto of [true, false]) {
    _IMP_CAMPOS.forEach(c => {
      if (map[c.k] >= 0) return;
      const i = n.findIndex((h, idx) => !usadas.has(idx) && c.sin.some(s => exacto ? h === s : (h.includes(s) && s.length >= 4)));
      if (i >= 0) { map[c.k] = i; usadas.add(i); }
    });
  }
  _IMP_CAMPOS.forEach(c => { if (!(map[c.k] >= 0)) map[c.k] = -1; });
  return map;
}

// Convierte las filas en productos según el mapeo actual
function _impArmar() {
  const m = _imp.map, celda = (r, k) => m[k] >= 0 ? r[m[k]] : '';
  const txt = v => String(v ?? '').trim().replace(/\s+/g, ' ');
  const cats = categories.filter(c => c.code !== 'por_revisar');
  const catDe = v => {
    const t = _impNorm(v); if (!t) return null;
    return cats.find(c => _impNorm(c.label) === t || _impNorm(c.code) === t)
        || cats.find(c => _impNorm(c.label).startsWith(t) || t.startsWith(_impNorm(c.label))) || null;
  };
  const porCodigo = new Map(products.filter(p => p.barcode).map(p => [p.barcode, p]));
  const nuevos = [], actualizar = [], saltados = { sinDatos: 0, repetidos: 0, existentes: 0 };
  const codigosArchivo = new Set();
  let sinCategoria = 0;
  _imp.filas.forEach(r => {
    const name = txt(celda(r, 'name'));
    const price = _impNum(celda(r, 'price'));
    if (!name || price === null || price < 0) { saltados.sinDatos++; return; }
    let barcode = txt(celda(r, 'barcode')).replace(/\s+/g, '');
    if (typeof celda(r, 'barcode') === 'number') barcode = String(Math.round(celda(r, 'barcode')));
    barcode = barcode || null;
    const cost = _impNum(celda(r, 'cost'));
    const stockN = _impNum(celda(r, 'stock'));
    const stock = stockN === null ? null : Math.max(0, Math.round(stockN));
    if (barcode && codigosArchivo.has(barcode)) { saltados.repetidos++; return; }
    if (barcode) codigosArchivo.add(barcode);
    const ya = barcode && porCodigo.get(barcode);
    if (ya) {
      if (_imp.existe === 'actualizar') actualizar.push({ p: ya, price, cost: cost !== null && cost >= 0 ? cost : null, stock });
      else saltados.existentes++;
      return;
    }
    const cat = catDe(celda(r, 'category'));
    if (!cat) sinCategoria++;
    nuevos.push({
      name, price, cost: cost !== null && cost >= 0 ? cost : null, stock: stock ?? 0, barcode,
      category: cat?.code || 'por_revisar', category_label: cat?.label || 'Por revisar',
      description: txt(celda(r, 'description')), supplier_code: txt(celda(r, 'supplier_code')) || null,
      talla: txt(celda(r, 'talla')), color: txt(celda(r, 'color')),
    });
  });
  // Tallas/colores: mismo nombre (y categoría) = una prenda
  const grupos = new Map();
  nuevos.forEach(n => {
    if (!n.talla && !n.color) return;
    const k = _impNorm(n.name) + '|' + n.category;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(n);
  });
  let prendas = 0;
  grupos.forEach(ms => {
    const conTalla = ms.some(x => x.talla), conColor = ms.some(x => x.color);
    const nTalla = ms.filter(x => x.talla).every(x => /^\d/.test(x.talla)) ? 'Número' : 'Talla';
    const vistos = new Set(), grupo = crypto.randomUUID();
    ms.forEach(n => {
      const variant = [];
      if (conTalla) variant.push([nTalla, /^[a-z]{1,4}$/i.test(n.talla) ? n.talla.toUpperCase() : (n.talla || 'Única')]);
      if (conColor) variant.push(['Color', n.color ? n.color.charAt(0).toUpperCase() + n.color.slice(1) : 'Único']);
      const clave = variant.map(e => e[1].toLowerCase()).join('|');
      if (vistos.has(clave)) { n._repetida = true; return; }
      vistos.add(clave);
      Object.assign(n, { variant_group: grupo, variant, variant_base: n.name, name: `${n.name} · ${variant.map(e => e[1]).join(' · ')}` });
    });
    prendas++;
  });
  const finales = nuevos.filter(n => !n._repetida);
  saltados.repetidos += nuevos.length - finales.length;
  return { nuevos: finales, actualizar, saltados, sinCategoria, prendas };
}

function _impPaso2() {
  const opts = i => `<option value="-1"${i === -1 ? ' selected' : ''}>— No usar —</option>` +
    _imp.cols.map((c, j) => `<option value="${j}"${j === i ? ' selected' : ''}>${_esc(c)}</option>`).join('');
  document.getElementById('imp-body').innerHTML = `
    <p class="imp-txt"><strong>${_esc(_imp.nombreArchivo)}</strong> · ${_imp.filas.length} renglones${_imp.hoja ? ` en la hoja "${_esc(_imp.hoja)}"` : ''}</p>
    <p class="imp-sub">Qué columna es cada dato</p>
    <div class="imp-map">${_IMP_CAMPOS.map(c => `
      <label class="imp-map-fila"><span>${c.label}${c.req ? ' <b aria-hidden="true">*</b>' : ''}</span>
        <select onchange="_imp.map['${c.k}']=+this.value;_impResumen()">${opts(_imp.map[c.k])}</select></label>`).join('')}
    </div>
    <p class="imp-sub">Si el código de barras ya existe en tu inventario</p>
    <label class="lbl-op"><input type="radio" name="imp-existe" value="saltar" ${_imp.existe === 'saltar' ? 'checked' : ''} onchange="_imp.existe=this.value;_impResumen()"> No tocarlo</label>
    <label class="lbl-op"><input type="radio" name="imp-existe" value="actualizar" ${_imp.existe === 'actualizar' ? 'checked' : ''} onchange="_imp.existe=this.value;_impResumen()"> Actualizar su precio, costo y piezas</label>
    ${can.publishProduct ? `<label class="checkbox-row imp-pub"><input type="checkbox" ${_imp.publicar ? 'checked' : ''} onchange="_imp.publicar=this.checked"> Publicar en la Tienda los productos nuevos</label>` : ''}
    <div id="imp-resumen"></div>`;
  document.getElementById('imp-foot').innerHTML = `
    <button class="btn btn-outline" onclick="_impPaso1()">Otro archivo</button>
    <button class="btn btn-gold" id="imp-go" onclick="_impImportar()">Importar</button>`;
  _impResumen();
}

function _impResumen() {
  const el = document.getElementById('imp-resumen'); if (!el) return;
  const btn = document.getElementById('imp-go');
  if (_imp.map.name < 0 || _imp.map.price < 0) {
    el.innerHTML = `<div class="imp-error">Elige qué columna es el <strong>Nombre</strong> y cuál el <strong>Precio de venta</strong>.</div>`;
    btn.disabled = true; btn.textContent = 'Importar'; return;
  }
  const r = _impArmar();
  const pz = n => `${n} pza${n !== 1 ? 's' : ''}`;
  const lineas = [
    r.nuevos.length ? `<li><strong>${r.nuevos.length}</strong> producto${r.nuevos.length !== 1 ? 's' : ''} nuevo${r.nuevos.length !== 1 ? 's' : ''}${r.prendas ? ` (${r.prendas} prenda${r.prendas !== 1 ? 's' : ''} con tallas o colores)` : ''}</li>` : '',
    r.actualizar.length ? `<li><strong>${r.actualizar.length}</strong> ya existente${r.actualizar.length !== 1 ? 's' : ''} se actualiza${r.actualizar.length !== 1 ? 'n' : ''}</li>` : '',
    r.saltados.existentes ? `<li>${r.saltados.existentes} ya existe${r.saltados.existentes !== 1 ? 'n' : ''} (mismo código): no se toca${r.saltados.existentes !== 1 ? 'n' : ''}</li>` : '',
    r.saltados.sinDatos ? `<li>${r.saltados.sinDatos} renglón${r.saltados.sinDatos !== 1 ? 'es' : ''} sin nombre o precio: se salta${r.saltados.sinDatos !== 1 ? 'n' : ''}</li>` : '',
    r.saltados.repetidos ? `<li>${r.saltados.repetidos} repetido${r.saltados.repetidos !== 1 ? 's' : ''} dentro del archivo: se salta${r.saltados.repetidos !== 1 ? 'n' : ''}</li>` : '',
    r.sinCategoria ? `<li>${r.sinCategoria} sin categoría reconocida: quedan en <strong>Por revisar</strong> (Inventario → Pendientes)</li>` : '',
  ].filter(Boolean).join('');
  el.innerHTML = `<p class="imp-sub">Así quedará</p><ul class="imp-lista">${lineas || '<li>Nada que importar con estas columnas.</li>'}</ul>
    ${r.nuevos.length ? `<div class="imp-prev">${r.nuevos.slice(0, 6).map(n => `<div class="imp-prev-fila">
      <span class="imp-prev-nom">${_esc(n.name)}</span>
      <span class="imp-prev-dato">${_esc(n.category_label)}</span>
      <span class="imp-prev-dato">${pz(n.stock)}</span>
      <span class="imp-prev-precio">$${n.price.toLocaleString('es-MX')}</span></div>`).join('')}
      ${r.nuevos.length > 6 ? `<p class="imp-mas">y ${r.nuevos.length - 6} más</p>` : ''}</div>` : ''}`;
  const total = r.nuevos.length + r.actualizar.length;
  btn.disabled = !total;
  btn.textContent = total ? `Importar ${total}` : 'Importar';
}

async function _impImportar() {
  const r = _impArmar();
  const total = r.nuevos.length + r.actualizar.length;
  if (!total) return;
  const btn = document.getElementById('imp-go');
  btn.disabled = true;
  const publicar = can.publishProduct && _imp.publicar;
  const yo = getCurrentUserEmail();
  let creados = 0, actualizados = 0, fallas = 0, error = '';
  const pos0 = products.length;
  for (let k = 0; k < r.nuevos.length; k += 100) {
    btn.textContent = `Guardando ${Math.min(k + 100, r.nuevos.length)} de ${r.nuevos.length}…`;
    const lote = r.nuevos.slice(k, k + 100).map((n, i) => ({
      name: n.name, price: n.price, cost: n.cost, stock: n.stock, barcode: n.barcode,
      category: n.category, category_label: n.category_label, description: n.description || '',
      supplier_code: n.supplier_code, image: DEFAULT_IMG, images: null, featured: false,
      is_published: publicar && n.price > 0, position: pos0 + k + i, created_by: yo,
      // Mismas llaves en todos (PostgREST rechaza un lote con llaves distintas)
      variant_group: n.variant_group || null, variant: n.variant || null, variant_base: n.variant_base || null,
    }));
    const res = await supabaseApi('products', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(lote) });
    if (!res.ok || !Array.isArray(res.data)) { fallas += lote.length; error = res.data?.message || res.data?.hint || `HTTP ${res.status}`; continue; }
    res.data.forEach(row => products.push(mapProduct(row)));
    creados += res.data.length;
  }
  for (let k = 0; k < r.actualizar.length; k += 8) {
    btn.textContent = `Actualizando ${Math.min(k + 8, r.actualizar.length)} de ${r.actualizar.length}…`;
    await Promise.all(r.actualizar.slice(k, k + 8).map(async u => {
      const body = { price: u.price };
      if (u.cost !== null) body.cost = u.cost;
      if (u.stock !== null) body.stock = u.stock;
      const res = await supabaseApi(`products?id=eq.${u.p.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!res.ok || !res.data?.[0]) { fallas++; return; }
      Object.assign(u.p, mapProduct(res.data[0])); _trackEdit(u.p.id); actualizados++;
    }));
  }
  logActivity('productos_importados', `Importó de "${_imp.nombreArchivo}": ${creados} nuevo${creados !== 1 ? 's' : ''}${actualizados ? `, ${actualizados} actualizado${actualizados !== 1 ? 's' : ''}` : ''}`,
    { archivo: _imp.nombreArchivo, creados, actualizados, fallas });
  renderTable(); renderStats();
  if (fallas) {
    // Sin "reintentar" aquí: lo que sí se guardó se volvería a crear (los que no
    // traen código no se pueden reconocer). Se avisa y se revisa en Inventario.
    closeImport();
    await teAlert(`Se guardaron ${creados + actualizados} y fallaron ${fallas}${error ? ` (${error})` : ''}. Revisa en Inventario cuáles faltan antes de volver a importar el archivo.`, 'Importación incompleta');
    return;
  }
  closeImport();
  toast(`${creados} producto${creados !== 1 ? 's' : ''} importado${creados !== 1 ? 's' : ''}${actualizados ? ` y ${actualizados} actualizado${actualizados !== 1 ? 's' : ''}` : ''}`, 'success');
  if (r.sinCategoria && creados) setTimeout(() => toast(`${r.sinCategoria} quedaron en "Por revisar": asígnales categoría en Pendientes`, ''), 2500);
}
