// Storage layer: IndexedDB wrapper (async)
const DB_NAME = 'catalogo_db_v2'
const STORE = 'products'

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('label', 'label', { unique: false })
        os.createIndex('createdAt', 'createdAt', { unique: false })
        os.createIndex('available', 'available', { unique: false })
      }
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function idbGetAll() {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => { res(req.result || []) }
    req.onerror = () => rej(req.error)
  })
}

async function idbPut(item) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(item)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function idbDelete(id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

async function idbClear() {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.clear()
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

// Default WhatsApp contact
const DEFAULT_WA_NUMBER = '5532999516238'

function buildWhatsAppLink(phone, template, label) {
  const clean = (DEFAULT_WA_NUMBER || '').replace(/[^0-9]/g, '')
  const text = (template || 'Olá! Gostei do item {label}. Quero um desse.').replace('{label}', label || '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

/* --- Toast Notifications --- */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast')
  if (!toast) return
  
  toast.textContent = message
  toast.className = `toast ${type}`
  toast.classList.add('show')
  
  setTimeout(() => {
    toast.classList.remove('show')
  }, duration)
}

/* --- Seed sample if empty --- */
async function seedIfEmpty() {
  const all = await idbGetAll()
  if (all.length > 0) return
  
  showToast('Inicializando catálogo com produtos de exemplo...', 'warning')
  
  const imgFiles = [
    'WhatsApp Image 2025-11-19 at 17.57.13.jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.14.jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.15.jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.16 (1).jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.16.jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.17 (1).jpeg',
    'WhatsApp Image 2025-11-19 at 17.57.17.jpeg'
  ]

  const existingImgs = new Set((all || []).map(p => (p.image_url || '').split('/').pop()))
  const usedLabels = new Set((all || []).map(p => String(p.label)))

  let nextNum = 1
  function nextLabel() {
    while (usedLabels.has(String(nextNum).padStart(4, '0'))) nextNum++
    const lab = String(nextNum).padStart(4, '0')
    usedLabels.add(lab)
    nextNum++
    return lab
  }

  for (let i = 0; i < imgFiles.length; i++) {
    const fname = imgFiles[i]
    if (existingImgs.has(fname)) continue
    const path = `img/produtos/${fname}`
    const label = nextLabel()
    const product = {
      id: uid(),
      label,
      name: `Cabeceira ${Number(label)}`,
      description: 'Cabeceira de alta qualidade, perfeita para complementar seu mobiliário.',
      price: 399 + i * 50,
      seller_phone: '',
      whatsapp_template: 'Olá! Gostei do item {label}. Quero um desse.',
      image_url: path,
      tags: ['cabeceira', 'móvel', 'quarto'],
      available: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await idbPut(product)
  }
  
  showToast('Catálogo inicializado com sucesso!', 'success')
}

/* --- Enhanced Products Rendering --- */
async function renderProductsList() {
  const container = document.getElementById('products')
  const resultsInfo = document.getElementById('results-info')
  const productsCount = document.getElementById('products-count')
  const activeFilters = document.getElementById('active-filters')
  
  if (!container) return

  // Show loading state
  container.innerHTML = `
    <div class="skeleton-cards">
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
      <div class="card skeleton skeleton-card"></div>
    </div>
  `

  const products = await idbGetAll()
  const q = (document.getElementById('search')?.value || '').toLowerCase().trim()
  const availability = document.getElementById('filter-availability')?.value || 'all'
  const sortBy = document.getElementById('sort-by')?.value || 'recent'

  let list = products.slice()
  let filterText = []

  if (availability === 'available') {
    list = list.filter(p => p.available !== false)
    filterText.push('Disponíveis')
  }

  if (q) {
    list = list.filter(p => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.label || '').toLowerCase().includes(q) || 
      (p.tags || []).join(' ').toLowerCase().includes(q)
    )
    filterText.push(`"${q}"`)
  }

  if (sortBy === 'price-asc') {
    list.sort((a, b) => (a.price || 0) - (b.price || 0))
    filterText.push('Menor preço')
  } else if (sortBy === 'price-desc') {
    list.sort((a, b) => (b.price || 0) - (a.price || 0))
    filterText.push('Maior preço')
  } else {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    filterText.push('Mais recentes')
  }

  // Update results info
  productsCount.textContent = `${list.length} produto${list.length !== 1 ? 's' : ''} encontrado${list.length !== 1 ? 's' : ''}`
  
  if (filterText.length > 0) {
    activeFilters.innerHTML = filterText.map(text => 
      `<span class="filter-tag">${escapeHtml(text)}</span>`
    ).join('')
  } else {
    activeFilters.innerHTML = ''
  }

  container.innerHTML = ''
  
  if (list.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <h3 style="color: var(--muted); margin-bottom: 8px;">Nenhum produto encontrado</h3>
        <p style="color: var(--muted-light);">Tente ajustar os filtros ou termos de busca.</p>
      </div>
    `
    return
  }

  list.forEach(p => {
    const card = document.createElement('article')
    card.className = `card ${p.available === false ? 'unavailable' : ''}`
    card.setAttribute('data-label', p.label)
    
    const imgHtml = p.image_url ? 
      `<div class="card-img"><img src="${escapeHtmlAttr(p.image_url)}" alt="${escapeHtmlAttr(p.name)}" loading="lazy"></div>` : 
      `<div class="card-img">📷 Sem imagem</div>`
    
    const tagsHtml = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')
    
    card.innerHTML = `
      ${imgHtml}
      <h3 class="title">${escapeHtml(p.name)} <span class="small-muted">(#${escapeHtml(p.label)})</span></h3>
      <div class="desc">${escapeHtml(p.description || '')}</div>
      <div class="product-meta">${tagsHtml}</div>
      <div class="price">${formatCurrency(p.price || 0)}</div>
      <div class="card-actions">
        <button class="btn-ghost" data-id="${p.id}" data-action="details" ${p.available === false ? 'disabled' : ''}>
          👁️ Detalhes
        </button>
        <a class="btn-primary" href="${buildWhatsAppLink(p.seller_phone, p.whatsapp_template, p.label)}" target="_blank" rel="noreferrer" ${p.available === false ? 'style="opacity: 0.6; pointer-events: none;"' : ''}>
          💬 WhatsApp
        </a>
      </div>
    `
    container.appendChild(card)
  })
}

/* --- Enhanced Product Modal --- */
async function openProductModal(id) {
  const products = await idbGetAll()
  const p = products.find(x => x.id === id)
  if (!p) return

  const body = document.getElementById('modal-body')
  const modal = document.getElementById('product-modal')
  
  body.innerHTML = `
    <div class="card-img" style="max-height: 400px;">
      ${p.image_url ? `<img src="${escapeHtmlAttr(p.image_url)}" alt="${escapeHtmlAttr(p.name)}">` : '📷 Sem imagem'}
    </div>
    <h2 class="title">${escapeHtml(p.name)} <span class="small-muted">(#${escapeHtml(p.label)})</span></h2>
    <div class="desc">${escapeHtml(p.description || '')}</div>
    <div class="product-meta">${(p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>
    <div class="price" style="font-size: 1.5rem; margin: 20px 0;">${formatCurrency(p.price || 0)}</div>
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      <button class="btn-ghost" data-id="${p.id}" data-action="add-cart" ${p.available === false ? 'disabled' : ''}>
        🛒 Adicionar ao carrinho
      </button>
      <a class="btn-primary" href="${buildWhatsAppLink(p.seller_phone, p.whatsapp_template, p.label)}" target="_blank" rel="noreferrer" style="flex: 1;" ${p.available === false ? 'style="opacity: 0.6; pointer-events: none;"' : ''}>
        💬 Chamar no WhatsApp
      </a>
    </div>
  `
  
  modal.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function closeProductModal() {
  const modal = document.getElementById('product-modal')
  if (modal) {
    modal.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }
}

/* --- Enhanced Admin --- */
async function setupAdmin() {
  const form = document.getElementById('product-form')
  if (!form) return

  if (!requireAuthOnAdmin()) return

  const elements = {
    id: document.getElementById('product-id'),
    label: document.getElementById('label'),
    name: document.getElementById('name'),
    description: document.getElementById('description'),
    price: document.getElementById('price'),
    seller_phone: document.getElementById('seller_phone'),
    whatsapp_template: document.getElementById('whatsapp_template'),
    image_url: document.getElementById('image_url'),
    tags: document.getElementById('tags'),
    resetBtn: document.getElementById('reset-btn')
  }

  async function renderAdminList() {
    const list = document.getElementById('admin-list')
    const products = await idbGetAll()
    
    if (products.length === 0) {
      list.innerHTML = '<div class="small-muted" style="text-align: center; padding: 40px;">Nenhum produto cadastrado</div>'
      return
    }
    
    list.innerHTML = products.map(p => `
      <div class="admin-list-item ${p.available === false ? 'unavailable' : ''}">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="small-muted">(#${escapeHtml(p.label)})</span>
            ${p.available === false ? '<span style="color: var(--error); font-size: 0.8rem;">[Indisponível]</span>' : ''}
          </div>
          <div class="small-muted" style="margin-bottom: 4px;">${escapeHtml(p.description || '')}</div>
          <div style="font-weight: 600; color: var(--brand);">${formatCurrency(p.price || 0)}</div>
        </div>
        <div class="flex">
          <button class="btn-ghost" data-id="${p.id}" data-action="edit">✏️ Editar</button>
          <button class="btn-ghost" data-id="${p.id}" data-action="toggle-availability">
            ${p.available === false ? '✅ Disponibilizar' : '⏸️ Suspender'}
          </button>
          <button class="btn-ghost" data-id="${p.id}" data-action="delete" style="color: var(--error);">🗑️ Remover</button>
        </div>
      </div>
    `).join('')
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    
    const products = await idbGetAll()
    const existingProduct = elements.id.value ? products.find(p => p.id === elements.id.value) : null
    
    const payload = {
      id: elements.id.value || uid(),
      label: elements.label.value.trim(),
      name: elements.name.value.trim(),
      description: elements.description.value.trim(),
      price: Number(elements.price.value) || 0,
      seller_phone: elements.seller_phone.value.trim(),
      whatsapp_template: elements.whatsapp_template.value.trim() || 'Olá! Gostei do item {label}. Quero um desse.',
      image_url: elements.image_url.value.trim(),
      tags: elements.tags.value.split(',').map(s => s.trim()).filter(Boolean),
      available: existingProduct ? existingProduct.available : true,
      createdAt: existingProduct ? existingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await idbPut(payload)
    form.reset()
    elements.id.value = ''
    await renderAdminList()
    await renderProductsList()
    showToast('Produto salvo com sucesso!')
  })

  elements.resetBtn.addEventListener('click', () => {
    form.reset()
    elements.id.value = ''
    showToast('Formulário limpo', 'warning')
  })

  document.getElementById('admin-list').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button')
    if (!btn) return
    
    const id = btn.dataset.id
    const action = btn.dataset.action
    const products = await idbGetAll()
    const p = products.find(x => x.id === id)
    
    if (!p) return

    if (action === 'edit') {
      elements.id.value = p.id
      elements.label.value = p.label
      elements.name.value = p.name
      elements.description.value = p.description
      elements.price.value = p.price
      elements.seller_phone.value = p.seller_phone
      elements.whatsapp_template.value = p.whatsapp_template
      elements.image_url.value = p.image_url
      elements.tags.value = (p.tags || []).join(', ')
      
      window.scrollTo({ top: 0, behavior: 'smooth' })
      showToast(`Editando: ${p.name}`)
    }
    
    if (action === 'toggle-availability') {
      p.available = !p.available
      p.updatedAt = new Date().toISOString()
      await idbPut(p)
      await renderAdminList()
      await renderProductsList()
      showToast(`Produto ${p.available ? 'disponibilizado' : 'suspenso'}`, 'warning')
    }
    
    if (action === 'delete') {
      if (!confirm(`Tem certeza que deseja remover "${p.name}"?`)) return
      await idbDelete(id)
      await renderAdminList()
      await renderProductsList()
      showToast('Produto removido', 'error')
    }
  })

  // Export/Import
  document.getElementById('export-btn').addEventListener('click', async () => {
    const data = JSON.stringify(await idbGetAll(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `produtos-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast('Catálogo exportado com sucesso!')
  })

  document.getElementById('import-file').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result)
        if (!Array.isArray(imported)) throw new Error('Formato inválido: deve ser um array de produtos')
        
        if (!confirm(`Importar ${imported.length} produto(s)? Isso substituirá todos os produtos atuais.`)) {
          ev.target.value = ''
          return
        }
        
        await idbClear()
        for (const p of imported) {
          if (!p.id) p.id = uid()
          if (!p.createdAt) p.createdAt = new Date().toISOString()
          p.updatedAt = new Date().toISOString()
          await idbPut(p)
        }
        
        await renderAdminList()
        await renderProductsList()
        ev.target.value = ''
        showToast(`Importação concluída: ${imported.length} produto(s)`, 'success')
      } catch (e) {
        showToast('Erro ao importar: ' + e.message, 'error')
        ev.target.value = ''
      }
    }
    reader.readAsText(file)
  })

  await renderAdminList()
}

/* --- Utilities --- */
function escapeHtml(s) { 
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[c]) 
}

function escapeHtmlAttr(s) { 
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function formatCurrency(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) 
}

/* --- Enhanced Cart System --- */
function getCart() { 
  try { 
    return JSON.parse(localStorage.getItem('cart_v2') || '[]') 
  } catch (e) { 
    return [] 
  } 
}

function saveCart(cart) { 
  localStorage.setItem('cart_v2', JSON.stringify(cart))
  updateCartCount()
}

function updateCartCount() {
  const cart = getCart()
  const total = cart.reduce((s, i) => s + i.qty, 0)
  const el = document.getElementById('cart-count')
  const btn = document.getElementById('cart-btn')
  
  if (el) el.textContent = total
  if (btn) {
    if (total > 0) {
      btn.classList.add('has-items')
    } else {
      btn.classList.remove('has-items')
    }
  }
}

function addToCart(productId, qty = 1) {
  const cart = getCart()
  const item = cart.find(c => c.id === productId)
  
  if (item) {
    item.qty += qty
  } else {
    cart.push({ id: productId, qty, addedAt: new Date().toISOString() })
  }
  
  saveCart(cart)
  showToast('Produto adicionado ao carrinho! 🛒')
}

function removeFromCart(productId) {
  let cart = getCart()
  const item = cart.find(c => c.id === productId)
  cart = cart.filter(c => c.id !== productId)
  saveCart(cart)
  renderCartModal()
  
  if (item) {
    showToast('Produto removido do carrinho', 'warning')
  }
}

function changeQty(productId, qty) {
  const cart = getCart()
  const item = cart.find(c => c.id === productId)
  if (!item) return
  
  if (qty <= 0) {
    removeFromCart(productId)
  } else {
    item.qty = qty
    saveCart(cart)
    renderCartModal()
  }
}

async function renderCartModal() {
  const body = document.getElementById('cart-body')
  if (!body) return
  
  const cart = getCart()
  const products = await idbGetAll()
  
  if (cart.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <div style="font-size: 3rem; margin-bottom: 16px;">🛒</div>
        <h3 style="margin-bottom: 8px;">Carrinho vazio</h3>
        <p>Adicione alguns produtos para ver aqui!</p>
      </div>
    `
    updateCartCount()
    return
  }
  
  const cartItems = cart.map(ci => {
    const p = products.find(x => x.id === ci.id)
    if (!p) return ''
    
    return `
      <div class="admin-list-item">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="small-muted">(#${escapeHtml(p.label)})</span>
          </div>
          <div class="small-muted" style="margin-bottom: 4px;">${escapeHtml(p.description || '')}</div>
          <div style="font-weight: 600; color: var(--brand);">${formatCurrency(p.price || 0)}</div>
        </div>
        <div class="flex" style="align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn-ghost" data-id="${p.id}" data-action="decrease" style="padding: 4px 8px; font-size: 1.2rem; min-height: 44px;">−</button>
            <input type="number" min="1" data-id="${p.id}" class="cart-qty" value="${ci.qty}" style="width: 60px; text-align: center; padding: 4px; min-height: 44px;">
            <button class="btn-ghost" data-id="${p.id}" data-action="increase" style="padding: 4px 8px; font-size: 1.2rem; min-height: 44px;">+</button>
          </div>
          <button class="btn-ghost" data-id="${p.id}" data-action="remove" style="color: var(--error); min-height: 44px;">🗑️</button>
        </div>
      </div>
    `
  }).join('')
  
  const total = cart.reduce((sum, ci) => {
    const p = products.find(x => x.id === ci.id)
    return sum + ((p?.price || 0) * ci.qty)
  }, 0)
  
  body.innerHTML = `
    <div style="max-height: 400px; overflow-y: auto;">
      ${cartItems}
    </div>
    <div style="border-top: 2px solid var(--border); padding-top: 20px; margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <strong style="font-size: 1.2rem;">Total:</strong>
        <strong style="font-size: 1.5rem; color: var(--brand);">${formatCurrency(total)}</strong>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button id="cart-whatsapp" class="btn-primary" style="flex: 2; min-height: 44px;">
          💬 Enviar pedido via WhatsApp
        </button>
        <button id="cart-clear" class="btn-ghost" style="flex: 1; min-height: 44px;">
          🗑️ Limpar
        </button>
      </div>
    </div>
  `
  
  updateCartCount()
  
  // Attach event listeners
  body.querySelectorAll('.cart-qty').forEach(inp => {
    inp.addEventListener('change', (ev) => {
      const id = ev.target.dataset.id
      const v = Number(ev.target.value) || 1
      changeQty(id, v)
    })
  })
  
  body.querySelectorAll('button[data-action="increase"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const cart = getCart()
      const item = cart.find(c => c.id === id)
      if (item) changeQty(id, item.qty + 1)
    })
  })
  
  body.querySelectorAll('button[data-action="decrease"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const cart = getCart()
      const item = cart.find(c => c.id === id)
      if (item) changeQty(id, item.qty - 1)
    })
  })
  
  body.querySelectorAll('button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id))
  })
  
  document.getElementById('cart-clear').addEventListener('click', () => {
    if (confirm('Limpar todo o carrinho?')) {
      localStorage.removeItem('cart_v2')
      renderCartModal()
      updateCartCount()
      showToast('Carrinho limpo', 'warning')
    }
  })
  
  document.getElementById('cart-whatsapp').addEventListener('click', async () => {
    const cartNow = getCart()
    const productsAll = await idbGetAll()
    
    if (cartNow.length === 0) {
      showToast('Carrinho vazio!', 'error')
      return
    }
    
    const items = cartNow.map(ci => {
      const p = productsAll.find(x => x.id === ci.id)
      return p ? `${p.name} (${ci.qty}x - ${formatCurrency(p.price * ci.qty)})` : `Produto ${ci.id}`
    })
    
    const total = cartNow.reduce((sum, ci) => {
      const p = productsAll.find(x => x.id === ci.id)
      return sum + ((p?.price || 0) * ci.qty)
    }, 0)
    
    const message = `Olá! Gostaria de fazer um pedido com os seguintes itens:\n\n${items.join('\n')}\n\n*Total: ${formatCurrency(total)}*\n\nPor favor, me informe sobre a disponibilidade e formas de pagamento.`
    
    const clean = (DEFAULT_WA_NUMBER || '').replace(/[^0-9]/g, '')
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
    
    window.open(url, '_blank')
  })
}

function buildWhatsAppCartLink(labels) {
  const clean = (DEFAULT_WA_NUMBER || '').replace(/[^0-9]/g, '')
  const list = labels.join(', ')
  let text = ''
  
  if (!labels || labels.length === 0) {
    text = 'Olá, tenho interesse em alguns produtos do catálogo.'
  } else if (labels.length === 1) {
    text = `Olá! Gostei do item ${list}. Quero um desse.`
  } else {
    text = `Olá! Gostei dos itens: ${list}. Vou querer todos.`
  }
  
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

/* --- Auth System --- */
function isAuthenticated() {
  return sessionStorage.getItem('admin_auth') === '1'
}

function showAdminControls() {
  const adminLink = document.getElementById('admin-link')
  
  if (isAuthenticated()) {
    if (adminLink) adminLink.style.display = ''
  } else {
    if (adminLink) adminLink.style.display = 'none'
  }
}

function requireAuthOnAdmin() {
  const path = location.pathname.split('/').pop()
  if (path === 'admin.html' && !isAuthenticated()) {
    location.href = 'login.html'
    return false
  }
  return true
}

/* --- Global Initialization --- */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando Catálogo Online...')
  
  try {
    // Initialize core functionality
    await seedIfEmpty()
    await migrateNamesToCabeceiraCompact()
    await renderProductsList()
    await setupAdmin()
    
    // Event listeners for main page
    document.getElementById('search')?.addEventListener('input', debounce(renderProductsList, 300))
    document.getElementById('filter-availability')?.addEventListener('change', renderProductsList)
    document.getElementById('sort-by')?.addEventListener('change', renderProductsList)
    
    // Product interactions
    document.getElementById('products')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button')
      if (!btn) return
      
      const id = btn.dataset.id
      const action = btn.dataset.action
      
      if (action === 'details') openProductModal(id)
      if (action === 'add-cart') addToCart(id)
    })
    
    // Modal controls
    document.getElementById('modal-close')?.addEventListener('click', closeProductModal)
    document.getElementById('product-modal')?.addEventListener('click', (ev) => {
      if (ev.target === ev.currentTarget) closeProductModal()
    })
    
    // Cart controls
    document.getElementById('cart-btn')?.addEventListener('click', () => {
      renderCartModal()
      const modal = document.getElementById('cart-modal')
      if (modal) {
        modal.setAttribute('aria-hidden', 'false')
        document.body.style.overflow = 'hidden'
      }
    })
    
    document.getElementById('cart-close')?.addEventListener('click', () => {
      const modal = document.getElementById('cart-modal')
      if (modal) {
        modal.setAttribute('aria-hidden', 'true')
        document.body.style.overflow = ''
      }
    })
    
    document.getElementById('cart-modal')?.addEventListener('click', (ev) => {
      if (ev.target === ev.currentTarget) {
        ev.currentTarget.setAttribute('aria-hidden', 'true')
        document.body.style.overflow = ''
      }
    })
    
    // Initialize auth and cart
    showAdminControls()
    requireAuthOnAdmin()
    updateCartCount()
    
    console.log('✅ Catálogo Online inicializado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro na inicialização:', error)
    showToast('Erro ao carregar o catálogo', 'error')
  }
})

/* --- Migration Functions --- */
async function migrateNamesToCabeceiraCompact() {
  const products = await idbGetAll()
  let changed = false
  
  for (const p of products) {
    const fname = (p.image_url || '').split('/').pop() || ''
    if (!fname.startsWith('WhatsApp Image')) continue
    
    const num = Number(String(p.label || '').replace(/^0+/, '') || '')
    if (!num) continue
    
    const desired = `Cabeceira ${num}`
    if (p.name !== desired) {
      p.name = desired
      p.updatedAt = new Date().toISOString()
      await idbPut(p)
      changed = true
    }
  }
  
  if (changed) {
    console.info('Migration: nomes de cabeceira atualizados')
  }
}

/* --- Utility Functions --- */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Keyboard accessibility
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    closeProductModal()
    const cartModal = document.getElementById('cart-modal')
    if (cartModal && cartModal.getAttribute('aria-hidden') === 'false') {
      cartModal.setAttribute('aria-hidden', 'true')
      document.body.style.overflow = ''
    }
  }
})