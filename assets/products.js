  const orderCatalogExtra = new Map();
  function getCatalogProducts() {
    let local=[];
    try { local=typeof allProducts !== 'undefined' && Array.isArray(allProducts) ? allProducts : []; } catch (_) {}
    return [...orderCatalogExtra.values(), ...local.filter(p=>!orderCatalogExtra.has(String(p.id)))];
  }
  function normalizeVariantList(items) {
    return (Array.isArray(items) ? items : []).map(item => typeof item === 'string'
      ? { nombre:item, incremento:0 }
      : { nombre:String(item?.nombre || ''), incremento:Number(item?.incremento || item?.adicional || 0), foto:item?.foto || item?.imagen || '' })
      .filter(item => item.nombre);
  }
  function orderCatalogProductAllowed(product) {
    if (!product) return false; // También permite localizar productos ocultos desde el panel interno.
    const rent = $('web-order-type')?.value === 'ALQUILER';
    return rent ? (product.alquiler === true || product.alquiler === 'true')
      : product.venta !== false && product.venta !== 'false';
  }
  function orderCatalogPrice(product) {
    return Math.max(0, Number(($('web-order-type')?.value === 'ALQUILER' ? (Number(product?.precio_alquiler || 0) + Number(product?.valor_deposito || 0)) : product?.precio_detal) || 0));
  }
  let orderProductRowCounter = 0;
  function addProductRow() {
    const container = $('web-order-products'); if (!container) return;
    const rowUid = `order-variant-${++orderProductRowCounter}`;
    const row = document.createElement('div'); row.className = 'admin-order-product-row admin-web-product-row';
    row.innerHTML = `
      <div class="wide admin-web-product-picker"><label class="admin-web-label">Seleccionar producto del catálogo</label><input class="admin-web-input" data-field="product_search" type="search" autocomplete="off" placeholder="Buscar producto por nombre..." aria-label="Buscar productos con fotografías" aria-expanded="false"><select class="hidden" tabindex="-1" aria-hidden="true" data-field="producto_id"><option value="">Selecciona un producto</option><option value="__custom__">Producto nuevo / personalizado</option></select><div class="admin-web-product-results" data-field="product_results" hidden></div><div class="admin-web-product-selected" data-field="product_selected" hidden></div><input class="admin-web-input mt-2 hidden" data-field="custom_name" placeholder="Nombre del producto nuevo"></div>
      <div><label class="admin-web-label" data-price-label>Precio base editable ($)</label><input class="admin-web-input" data-field="precio" type="number" min="0" step="1" value="0" required></div>
      <div data-deposit-box hidden><label class="admin-web-label">Depósito por unidad ($)</label><input class="admin-web-input" data-field="deposito" type="number" min="0" step="1" value="0"></div><div><label class="admin-web-label">Cantidad</label><input class="admin-web-input" data-field="cantidad" type="number" min="1" step="1" value="1" required></div>
      <div><label class="admin-web-label">Talla / medida</label><input class="admin-web-input" data-field="talla" list="${rowUid}-sizes" placeholder="Elegir o escribir"></div>
      <div><label class="admin-web-label">Color</label><input class="admin-web-input" data-field="color" list="${rowUid}-colors" placeholder="Elegir o escribir"></div>
      <div class="wide"><div class="flex justify-between items-center gap-2 mb-2"><label class="admin-web-label mb-0">Accesorios y aumentos</label><button type="button" class="admin-web-button" data-add-accessory><i class="fa-solid fa-plus mr-1"></i> Agregar accesorio</button></div><div data-accessory-rows class="space-y-2"></div></div>
      <div><label class="admin-web-label">Incremento manual ($)</label><input class="admin-web-input" data-field="incremento_manual" type="number" min="0" step="1" value="0"></div>
      <div class="wide"><label class="admin-web-label">Fotografía de este producto</label><input class="admin-web-input" data-field="product_photo" type="file" accept="image/*"><div data-field="product_photo_preview" class="mt-2" hidden></div></div>
      <div class="wide"><p class="text-xs font-black text-pink-700" data-line-total>Subtotal: $ 0</p></div>
      <div class="wide"><label class="admin-web-label">Datos de personalización (opcional)</label><input class="admin-web-input" data-field="referencia" placeholder="Nombre, texto o indicaciones de personalización"></div>
      <div class="wide flex justify-end"><button type="button" class="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold" title="Quitar producto" onclick="this.closest('.admin-web-product-row').remove();recalculateWebOrderTotal()"><i class="fa-solid fa-trash mr-1"></i> Quitar</button></div>`;
    container.appendChild(row);
    const dep=row.querySelector('[data-field="deposito"]'); const depBox=row.querySelector('[data-deposit-box]'); depBox.hidden=$('web-order-type').value!=='ALQUILER'; row.querySelector('[data-price-label]').textContent=depBox.hidden?'Precio base editable ($)':'Alquiler por unidad, sin depósito ($)'; dep.addEventListener('input',recalculateWebOrderTotal);

    const customBtn=document.createElement('button'); customBtn.type='button'; customBtn.className='admin-web-button'; customBtn.textContent='Crear producto personalizado'; row.querySelector('.admin-web-product-picker').append(customBtn); customBtn.addEventListener('click',()=>setProductSelection('__custom__','Producto nuevo / personalizado'));
    const photoInput = row.querySelector('[data-field="product_photo"]');
    const photoPreview = row.querySelector('[data-field="product_photo_preview"]');
    photoInput.addEventListener('change', () => {
      if (row._cupissaPreviewUrl) URL.revokeObjectURL(row._cupissaPreviewUrl);
      const file = photoInput.files?.[0];
      row._cupissaPreviewUrl = file ? URL.createObjectURL(file) : '';
      photoPreview.hidden = !file;
      photoPreview.replaceChildren();
      if (file) {
        const img = document.createElement('img');
        img.src = row._cupissaPreviewUrl; img.alt = 'Vista previa del producto';
        img.style.cssText = 'width:76px;height:76px;object-fit:cover;border-radius:12px;border:1px solid #eee';
        photoPreview.appendChild(img);
      }
    });
    const productSearch = row.querySelector('[data-field="product_search"]');
    const productSelect = row.querySelector('[data-field="producto_id"]');
    const customName = row.querySelector('[data-field="custom_name"]');
    const sizeInput = row.querySelector('[data-field="talla"]');
    const colorInput = row.querySelector('[data-field="color"]');
    const priceInput = row.querySelector('[data-field="precio"]');
    const manualIncrementInput = row.querySelector('[data-field="incremento_manual"]');
    const datalistIds = {
      talla: sizeInput.getAttribute('list'), color: colorInput.getAttribute('list'), accesorio: `${rowUid}-accessories`
    };
    Object.values(datalistIds).forEach(id => { const list = document.createElement('datalist'); list.id = id; row.appendChild(list); });
    row._variantIncrease = 0;
    row._accessoryOptions = [];
    const accessoryRows = row.querySelector('[data-accessory-rows]');
    function addAccessory(name = '', increment = 0) {
      const entry = document.createElement('div');
      entry.className = 'admin-order-accessory-row';
      entry.innerHTML = `<input class="admin-web-input" data-accessory-name list="${datalistIds.accesorio}" placeholder="Accesorio (elige o escribe)" aria-label="Nombre del accesorio"><input class="admin-web-input" data-accessory-increase type="number" min="0" step="1" value="0" aria-label="Aumento del accesorio en pesos"><button type="button" class="admin-web-button" data-remove-accessory aria-label="Quitar accesorio"><i class="fa-solid fa-xmark"></i></button>`;
      accessoryRows.appendChild(entry);
      const nameInput = entry.querySelector('[data-accessory-name]');
      const incrementInput = entry.querySelector('[data-accessory-increase]');
      nameInput.value = name;
      incrementInput.value = String(increment);
      nameInput.addEventListener('change', () => {
        const match = row._accessoryOptions.find(item => item.nombre.toLowerCase() === nameInput.value.trim().toLowerCase());
        if (match) incrementInput.value = String(match.incremento);
        recalculateWebOrderTotal();
      });
      entry.addEventListener('input', recalculateWebOrderTotal);
      entry.querySelector('[data-remove-accessory]').addEventListener('click', () => { entry.remove(); recalculateWebOrderTotal(); });
      recalculateWebOrderTotal();
    }
    row.querySelector('[data-add-accessory]').addEventListener('click', () => addAccessory());

    // Selector personalizado: los <option> HTML no pueden contener fotografías.
    // Conservamos el select oculto para no alterar la lógica de variantes ni el guardado.
    const productResults = row.querySelector('[data-field="product_results"]');
    const productSelected = row.querySelector('[data-field="product_selected"]');
    const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const productPhoto = product => {
      const first = Array.isArray(product?.fotos) ? product.fotos[0] : null;
      const raw = typeof first === 'string' ? first : (first?.url || first?.foto || first?.imagen || product?.imagen_url || product?.imagen || '');
      return typeof raw === 'string' && /^(https?:\/\/|data:image\/|blob:)/i.test(raw) ? raw : '';
    };
    const thumb = product => {
      const photo = productPhoto(product);
      return photo ? `<img class="admin-web-product-thumb" loading="lazy" src="${esc(photo)}" alt="" onerror="this.replaceWith(document.createTextNode('Sin foto'))">` : '<span class="admin-web-product-no-photo"><i class="fa-regular fa-image"></i></span>';
    };
    const setProductSelection = (id, label) => {
      productSelect.innerHTML = `<option value="">Selecciona un producto</option><option value="${esc(id)}" selected>${esc(label)}</option>`;
      productSelect.value = String(id);
      productSelect.dispatchEvent(new Event('change'));
      productResults.hidden = true;
      productSearch.setAttribute('aria-expanded', 'false');
      if (id === '__custom__') {
        productSearch.value = 'Producto nuevo / personalizado';
        productSelected.hidden = true;
      } else {
        const product = getCatalogProducts().find(item => String(item.id) === String(id));
        productSearch.value = String(product?.nombre || label);
        productSelected.innerHTML = `<div class="admin-web-product-option">${thumb(product)}<span class="admin-web-product-option-text"><strong>${esc(product?.nombre || label)}</strong><small>${cop(orderCatalogPrice(product))}</small></span><span class="admin-web-product-check"><i class="fa-solid fa-check"></i></span></div>`;
        productSelected.hidden = false;
      }
    };
    // Consulta el catálogo COMPLETO en el servidor, no solamente allProducts en memoria.
    // Supabase impone límites de respuesta: paginación + búsqueda permiten acceder a
    // cualquier producto aunque existan millones, sin bloquear el navegador.
    let productSearchSeq=0, productSearchTimer=null;
    async function renderProductResults(page=0) {
      const seq=++productSearchSeq;
      const query=productSearch.value.trim();
      const limit=100;
      productResults.hidden=false; productSearch.setAttribute('aria-expanded','true');
      productResults.innerHTML='<p class="admin-web-product-empty">Buscando en todo el catálogo…</p>';
      try {
        let request=db.rpc('cupissa_asesor_catalogo',{p_q:query,p_tipo:$('web-order-type').value,p_offset:page*limit});
        // El filtro se ejecuta en la base de datos y alcanza también registros aún no cargados.
        const {data,error}=await request;
        if(error)throw error;
        if(seq!==productSearchSeq || !row.isConnected)return;
        const matches=(data||[]).filter(orderCatalogProductAllowed);
        matches.forEach(product=>orderCatalogExtra.set(String(product.id),product));
        productResults.innerHTML=matches.map((product,idx)=>`<button type="button" class="admin-web-product-option" data-product-result="${idx}">${thumb(product)}<span class="admin-web-product-option-text"><strong>${esc(product.nombre||'Producto sin nombre')}</strong><small>${cop(orderCatalogPrice(product))}</small></span></button>`).join('')+
          `<button type="button" class="admin-web-product-option admin-web-product-custom" data-product-custom="1"><span class="admin-web-product-no-photo"><i class="fa-solid fa-plus"></i></span><span class="admin-web-product-option-text"><strong>Producto nuevo / personalizado</strong><small>Registrar manualmente</small></span></button>`+
          (page>0?`<button type="button" class="admin-web-product-option" data-product-prev="1"><strong>100 productos anteriores</strong></button>`:'')+
          (data?.length===limit?`<button type="button" class="admin-web-product-option" data-product-next="1"><strong>Mostrar 100 productos más</strong></button>`:'')+
          (!matches.length?'<p class="admin-web-product-empty">No hay coincidencias en esta página.</p>':'');
        productResults.querySelectorAll('[data-product-result]').forEach(button=>button.addEventListener('click',()=>{
          const product=matches[Number(button.dataset.productResult)];
          if(product)setProductSelection(product.id,product.nombre||'Producto');
        }));
        productResults.querySelector('[data-product-custom]')?.addEventListener('click',()=>setProductSelection('__custom__','Producto nuevo / personalizado'));
        productResults.querySelector('[data-product-prev]')?.addEventListener('click',()=>renderProductResults(page-1));
        productResults.querySelector('[data-product-next]')?.addEventListener('click',()=>renderProductResults(page+1));
      } catch(error) {
        if(seq===productSearchSeq) productResults.innerHTML=`<p class="admin-web-product-empty">No se pudo consultar todo el catálogo: ${esc(error.message||error)}</p>`;
      }
    }
    productSearch.addEventListener('focus',()=>renderProductResults(0));
    productSearch.addEventListener('input',()=>{
      productSelect.value='';productSelected.hidden=true;row.dataset.productName='';row.dataset.catalogPriceLoaded='';
      clearTimeout(productSearchTimer);productSearchTimer=setTimeout(()=>renderProductResults(0),250);
    });
    productSearch.addEventListener('keydown', event => {
      if (event.key === 'Escape') { productResults.hidden = true; productSearch.setAttribute('aria-expanded', 'false'); }
      if (event.key === 'Enter' && !productResults.hidden) {
        event.preventDefault();
        productResults.querySelector('[data-product-result], [data-product-custom]')?.click();
      }
    });
    document.addEventListener('click', event => {
      if (!row.isConnected) return;
      if (!row.querySelector('.admin-web-product-picker')?.contains(event.target)) {
        productResults.hidden = true;
        productSearch.setAttribute('aria-expanded', 'false');
      }
    }, { signal: row._productPickerAbort?.signal });

    const chooseVariant = () => {
      const product = getCatalogProducts().find(item => String(item.id) === String(productSelect.value));
      if (!product) return;
      const sizeOptions = normalizeVariantList(product.tallas);
      const colorOptions = normalizeVariantList(product.colores);
      const accessoryOptions = normalizeVariantList(product.accesorios);
      const setList = (id, values) => {
        const list = row.querySelector(`#${CSS.escape(id)}`); if (!list) return;
        list.innerHTML = values.map(item => `<option value="${esc(item.nombre)}"></option>`).join('');
      };
      setList(datalistIds.talla, sizeOptions);
      setList(datalistIds.color, colorOptions);
      setList(datalistIds.accesorio, accessoryOptions);
      row._accessoryOptions = accessoryOptions;
      accessoryRows.replaceChildren();
      customName.classList.add('hidden');
      customName.value = product.nombre || '';
      row.dataset.productName = product.nombre || '';
      row.dataset.productRef = product.referencia || ''; dep.value=$('web-order-type').value==='ALQUILER'?Number(product.valor_deposito||0):0; dep.readOnly=true;
      [sizeInput, colorInput].forEach(input => input.value = '');
      manualIncrementInput.value = '0';
      updateProductLinePrice(product);
    };
    productSelect.addEventListener('change', () => {
      if (productSelect.value === '__custom__') {
        dep.value=0; dep.readOnly=false; customName.classList.remove('hidden'); customName.value = ''; row.dataset.productName = ''; row.dataset.productRef = '';
        row.dataset.catalogPriceLoaded=''; priceInput.value = '0'; row._variantIncrease = 0; row._accessoryOptions = []; accessoryRows.replaceChildren(); productSelected.hidden = true;
      } else if (!productSelect.value) {
        customName.classList.add('hidden'); row.dataset.productName = ''; row.dataset.catalogPriceLoaded=''; priceInput.value = '0'; row._variantIncrease = 0; accessoryRows.replaceChildren();
      } else chooseVariant();
      recalculateWebOrderTotal();
    });
    function updateProductLinePrice(product) {
      if (product) {
        const variantMap = { talla:normalizeVariantList(product.tallas), color:normalizeVariantList(product.colores) };
        const variantIncrement = Object.entries(variantMap).reduce((total, [key, list]) => {
          const input = row.querySelector(`[data-field="${key}"]`);
          const match = list.find(item => item.nombre.toLowerCase() === String(input?.value || '').trim().toLowerCase());
          return total + Number(match?.incremento || 0);
        }, 0);
        row._variantIncrease = $('web-order-type')?.value === 'ALQUILER' ? 0 : variantIncrement;
        if (row.dataset.catalogPriceLoaded !== String(product.id)) {
          priceInput.value = String($('web-order-type').value==='ALQUILER'?Math.max(0,Number(product.precio_alquiler||0)):orderCatalogPrice(product));
          row.dataset.catalogPriceLoaded = String(product.id);
        }
      }
      recalculateWebOrderTotal();
    }
    [sizeInput, colorInput].forEach(input => input.addEventListener('change', () => {
      const product = getCatalogProducts().find(item => String(item.id) === String(productSelect.value));
      updateProductLinePrice(product);
    }));
    manualIncrementInput.addEventListener('input', recalculateWebOrderTotal);
    customName.addEventListener('input', () => { row.dataset.productName = customName.value; });
    row.addEventListener('input', event => { if (event.target.matches('[data-field="precio"],[data-field="cantidad"]')) recalculateWebOrderTotal(); });
    row._resetForOrderType = () => {
      dep.value=0; dep.readOnly=false; depBox.hidden=$('web-order-type').value!=='ALQUILER'; row.querySelector('[data-price-label]').textContent=depBox.hidden?'Precio base editable ($)':'Alquiler por unidad, sin depósito ($)'; customName.classList.add('hidden'); customName.value=''; productSelect.value = ''; productSearch.value = ''; productSelected.hidden = true; productResults.hidden = true;
      row.dataset.productName = ''; row.dataset.catalogPriceLoaded = ''; row._variantIncrease = 0;
      priceInput.value = '0'; sizeInput.value = ''; colorInput.value = ''; accessoryRows.replaceChildren();
      recalculateWebOrderTotal();
    };
  }
  window.addWebOrderProductRow = addProductRow;
  window.recalculateWebOrderTotal = function () {
    const total = Array.from(document.querySelectorAll('#web-order-products .admin-web-product-row')).reduce((sum,row) => {
      const price = Number(row.querySelector('[data-field="precio"]')?.value || 0);
      const quantity = Math.max(1, Number(row.querySelector('[data-field="cantidad"]')?.value || 1));
      const accessoryTotal = Array.from(row.querySelectorAll('[data-accessory-rows] .admin-order-accessory-row')).reduce((amount,entry) => amount + Math.max(0,Number(entry.querySelector('[data-accessory-increase]')?.value || 0)),0);
      const manual = Math.max(0,Number(row.querySelector('[data-field="incremento_manual"]')?.value || 0));
      const unitTotal = price + ($('web-order-type')?.value === 'ALQUILER' ? Math.max(0,Number(row.querySelector('[data-field=deposito]')?.value||0)) : (row._variantIncrease || 0)) + manual + accessoryTotal;
      const line = row.querySelector('[data-line-total]');
      if (line) line.textContent = `Unidad: ${cop(unitTotal)} · Subtotal: ${cop(unitTotal * quantity)}`;
      return sum + unitTotal * quantity;
    },0);
    const input = $('web-order-total'); if (input) input.value = String(total);
    if (typeof window.updateWebOrderBalancePreview === 'function') window.updateWebOrderBalancePreview();
  };

  // Única fórmula para el saldo del formulario: total de productos + envío - anticipo.
  function updateWebOrderBalancePreview() {
    const total = Math.max(0, Number($('web-order-total')?.value || 0));
    const shipping = Math.max(0, Number($('web-order-shipping')?.value || 0));
    const advance = Math.max(0, Number($('web-order-advance')?.value || 0));
    const remaining = Math.max(0, total + shipping - advance);
    const amount = $('web-order-remaining');
    if (amount) amount.textContent = cop(remaining);
    const breakdown = $('web-order-balance-detail');
    if (breakdown) breakdown.textContent = `Productos: ${cop(total)} + Envío: ${cop(shipping)} − Anticipo: ${cop(advance)}`;
    return remaining;
  }
  window.updateWebOrderBalancePreview = updateWebOrderBalancePreview;


window.asesorCatalogProduct = id => getCatalogProducts().find(p=>String(p.id)===String(id));
