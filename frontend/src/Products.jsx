import { useEffect, useRef, useState } from 'react'
import { AppShell } from './Navbar'
import { api, apiUrl } from './api'

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  category: '',
  brand: '',
  quantity: '0',
  costPrice: '',
  sellingPrice: '',
  lowStockThreshold: ''
}

const fetchInventory = () => Promise.all([
  api('/products'),
  api('/settings')
])

const parseCsv = (text) => {
  const cleanText = text.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index]

    if (character === '"') {
      if (quoted && cleanText[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && cleanText[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (quoted) throw new Error('The CSV file contains an unclosed quoted field.')
  row.push(value)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  return rows
}

const normalizeHeader = (header) => header
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

const csvHeaderMap = {
  name: 'name',
  productname: 'name',
  sku: 'sku',
  barcode: 'barcode',
  description: 'description',
  category: 'category',
  brand: 'brand',
  quantity: 'quantity',
  quantityonhand: 'quantity',
  costprice: 'costPrice',
  sellingprice: 'sellingPrice',
  lowstockthreshold: 'lowStockThreshold',
  reorderpoint: 'lowStockThreshold'
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [defaultThreshold, setDefaultThreshold] = useState(5)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyProductId, setBusyProductId] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [movements, setMovements] = useState([])
  const [movementProduct, setMovementProduct] = useState(null)
  const [movementType, setMovementType] = useState('stock-in')
  const [movementQuantity, setMovementQuantity] = useState('1')
  const [movementNote, setMovementNote] = useState('')
  const [isMoving, setIsMoving] = useState(false)
  const fileInputRef = useRef(null)

  const showMessage = (text, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  const loadData = async () => {
    try {
      const [productData, settingsData] = await fetchInventory()
      setProducts(productData.products)
      setDefaultThreshold(settingsData.defaultLowStockThreshold)
      const movementData = await api('/products/movements')
      setMovements(movementData.movements)
      return true
    } catch (err) {
      showMessage(err.message, true)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    fetchInventory()
      .then(([productData, settingsData]) => {
        if (!active) return
        setProducts(productData.products)
        setDefaultThreshold(settingsData.defaultLowStockThreshold)
        api('/products/movements')
          .then((movementData) => {
            if (active) setMovements(movementData.movements)
          })
          .catch(() => {})
      })
      .catch((err) => {
        if (active) showMessage(err.message, true)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const openAddForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setMessage('')
  }

  const openEditForm = (product) => {
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      description: product.description || '',
      category: product.category || '',
      brand: product.brand || '',
      quantity: String(product.quantity),
      costPrice: product.costPrice == null ? '' : String(product.costPrice),
      sellingPrice: product.sellingPrice == null ? '' : String(product.sellingPrice),
      lowStockThreshold: product.lowStockThreshold == null ? '' : String(product.lowStockThreshold)
    })
    setEditingId(product._id)
    setShowForm(true)
    setMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    const body = {
      name: form.name,
      sku: form.sku,
      barcode: form.barcode,
      description: form.description,
      category: form.category,
      brand: form.brand,
      quantity: form.quantity === '' ? 0 : Number(form.quantity),
      costPrice: form.costPrice === '' ? null : Number(form.costPrice),
      sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice),
      lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold)
    }

    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: 'PUT', body })
        showMessage('Product updated.')
      } else {
        await api('/products', { method: 'POST', body })
        showMessage('Product added to your inventory.')
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      await loadData()
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return

    setBusyProductId(product._id)
    try {
      await api(`/products/${product._id}`, { method: 'DELETE' })
      showMessage('Product deleted.')
      await loadData()
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setBusyProductId(null)
    }
  }

  const adjustStock = async (product, change) => {
    setBusyProductId(product._id)
    try {
      await api(`/products/${product._id}/movement`, {
        method: 'POST',
        body: {
          type: change > 0 ? 'stock-in' : 'stock-out',
          quantity: Math.abs(change),
          note: 'Quick stock adjustment'
        }
      })
      await loadData()
      showMessage('Stock level updated.')
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setBusyProductId(null)
    }
  }

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(apiUrl('/products/export'), {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed to export products')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'stockflow-products.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showMessage('Inventory exported successfully.')
    } catch (err) {
      showMessage(err.message, true)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsImporting(true)
    setMessage('')
    try {
      const csvText = await file.text()
      const rows = parseCsv(csvText)
      if (rows.length < 2) throw new Error('The CSV file does not contain any product rows.')

      const headers = rows[0].map(normalizeHeader)
      const unmappedHeaders = headers.map((header) => csvHeaderMap[header]).filter(Boolean)
      if (!headers.includes('name') && !unmappedHeaders.includes('name')) {
        throw new Error('The CSV file must include a Name or Product Name column.')
      }
      if (!headers.includes('sku') && !headers.map(normalizeHeader).includes('sku')) {
        throw new Error('The CSV file must include a SKU column.')
      }

      const importedProducts = rows.slice(1).map((cells) => {
        const product = {}
        headers.forEach((header, index) => {
          const field = csvHeaderMap[header]
          if (field) product[field] = cells[index]?.trim() ?? ''
        })
        return product
      })

      const result = await api('/products/import', {
        method: 'POST',
        body: { products: importedProducts }
      })

      await loadData()
      const errorSuffix = result.errors.length
        ? ` ${result.errors.length} row(s) could not be imported.`
        : ''
      showMessage(
        `${result.message}.${errorSuffix}`,
        result.errors.length > 0
      )
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setIsImporting(false)
    }
  }

  const openMovement = (product) => {
    setMovementProduct(product)
    setMovementType('stock-in')
    setMovementQuantity('1')
    setMovementNote('')
  }

  const submitMovement = async (event) => {
    event.preventDefault()
    if (!movementProduct) return

    setIsMoving(true)
    try {
      const data = await api(`/products/${movementProduct._id}/movement`, {
        method: 'POST',
        body: {
          type: movementType,
          quantity: Number(movementQuantity),
          note: movementNote
        }
      })
      setMovementProduct(null)
      await loadData()
      showMessage(`Stock movement recorded. New quantity: ${data.quantity}.`)
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setIsMoving(false)
    }
  }

  const printBarcode = (product) => {
    const code = product.barcode || product.sku
    const printWindow = window.open('', '_blank', 'width=500,height=400')
    if (!printWindow) {
      showMessage('Allow popups to print a barcode label.', true)
      return
    }
    printWindow.document.write(`<!doctype html><html><body style="font-family:Arial;text-align:center;padding:30px"><h2>${product.name.replace(/[<>&]/g, '')}</h2><div style="font-size:30px;letter-spacing:2px;border:2px solid #111;padding:16px;display:inline-block">${code.replace(/[<>&]/g, '')}</div><p>SKU: ${product.sku.replace(/[<>&]/g, '')}</p></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = product.name.toLowerCase().includes(query)
      || product.sku.toLowerCase().includes(query)
      || (product.barcode || '').toLowerCase().includes(query)
      || (product.category || '').toLowerCase().includes(query)
      || (product.brand || '').toLowerCase().includes(query)
    const threshold = product.lowStockThreshold ?? defaultThreshold
    return matchesSearch && (!lowStockOnly || product.quantity <= threshold)
  })

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>Inventory</h1>
          <p className="page-subtitle">Manage products, quantities, and reorder points.</p>
        </div>
        <button className="button button-primary" onClick={openAddForm}>
          <span aria-hidden="true">＋</span> Add product
        </button>
      </section>

      {message && (
        <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`} role={isError ? 'alert' : 'status'}>
          {message}
          <button className="alert-dismiss" onClick={() => setMessage('')} aria-label="Dismiss message">×</button>
        </div>
      )}

      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search products or SKU…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search products or SKU"
            />
          </div>
          <div className="toolbar-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
              hidden
            />
            <button
              className="button button-filter"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <span aria-hidden="true">⇧</span>
              {isImporting ? 'Importing…' : 'Import CSV'}
            </button>
            <button
              className="button button-filter"
              type="button"
              onClick={handleExport}
            >
              <span aria-hidden="true">⇩</span>
              Export CSV
            </button>
            <button
              className={`button button-filter${lowStockOnly ? ' selected' : ''}`}
              onClick={() => setLowStockOnly((current) => !current)}
              aria-pressed={lowStockOnly}
            >
              <span aria-hidden="true">⚑</span>
              Low stock
            </button>
            <span className="product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-card">Loading your inventory…</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state inventory-empty">
            <span className="empty-state-icon" aria-hidden="true">▤</span>
            <strong>{products.length ? 'No matching products' : 'Your inventory is ready'}</strong>
            <p>
              {products.length
                ? 'Try another search or turn off the low stock filter.'
                : 'Add your first product to start keeping track of stock.'}
            </p>
            {!products.length && (
              <button className="button button-primary" onClick={openAddForm}>Add your first product</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>Product name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Quantity</th>
                  <th>Reorder point</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const threshold = product.lowStockThreshold ?? defaultThreshold
                  const isLow = product.quantity <= threshold
                  const isBusy = busyProductId === product._id

                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="product-cell">
                          <span className="product-avatar" aria-hidden="true">
                            {product.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <strong className="product-name-cell">{product.name}</strong>
                            {product.description && <small>{product.description}</small>}
                          </span>
                        </div>
                      </td>
                      <td>{product.category || '—'}</td>
                      <td>{product.brand || '—'}</td>
                      <td><span className="sku-text">{product.sku}</span></td>
                      <td>{product.barcode || '—'}</td>
                      <td>
                        <div className="stock-stepper">
                          <button
                            className="stepper-button"
                            onClick={() => adjustStock(product, -1)}
                            disabled={isBusy || product.quantity === 0}
                            aria-label={`Decrease ${product.name} stock`}
                          >−</button>
                          <strong>{product.quantity}</strong>
                          <button
                            className="stepper-button"
                            onClick={() => adjustStock(product, 1)}
                            disabled={isBusy}
                            aria-label={`Increase ${product.name} stock`}
                          >＋</button>
                        </div>
                      </td>
                      <td>{threshold}</td>
                      <td>{product.sellingPrice == null ? '—' : Number(product.sellingPrice).toFixed(2)}</td>
                      <td>
                        <span className={`status-pill ${isLow ? 'status-low' : 'status-healthy'}`}>
                          <i />{isLow ? 'Low stock' : 'In stock'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-button" onClick={() => openMovement(product)} aria-label={`Record movement for ${product.name}`} title="Stock movement">
                            ⇄
                          </button>
                          <button className="icon-button" onClick={() => printBarcode(product)} aria-label={`Print barcode for ${product.name}`} title="Print label">
                            ▱
                          </button>
                          <button className="icon-button" onClick={() => openEditForm(product)} aria-label={`Edit ${product.name}`} title="Edit">
                            ✎
                          </button>
                          <button className="icon-button icon-button-danger" onClick={() => handleDelete(product)} disabled={isBusy} aria-label={`Delete ${product.name}`} title="Delete">
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && products.length > 0 && (
          <div className="table-footer">
            Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
          </div>
        )}
      </section>

      <section className="panel movement-history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AUDIT TRAIL</p>
            <h2>Stock adjustment history</h2>
          </div>
        </div>
        {movements.length === 0 ? (
          <div className="empty-state">
            <strong>No stock movements yet</strong>
            <p>Use the stock movement action or quantity controls to create a history.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Quantity</th>
                  <th>Note</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement._id}>
                    <td><strong className="product-name-cell">{movement.productName}</strong><br /><span className="sku-text">{movement.sku}</span></td>
                    <td>{movement.type}</td>
                    <td className={movement.quantity < 0 ? 'quantity-low' : 'status-healthy'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td>
                    <td>{movement.previousQuantity} → {movement.newQuantity}</td>
                    <td>{movement.note || '—'}</td>
                    <td>{new Date(movement.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {movementProduct && (
        <div className="modal-backdrop">
          <section className="product-modal movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">STOCK MOVEMENT</p>
                <h2 id="movement-title">{movementProduct.name}</h2>
                <p>Current quantity: {movementProduct.quantity}</p>
              </div>
              <button className="icon-button modal-close" onClick={() => setMovementProduct(null)} aria-label="Close stock movement">×</button>
            </div>
            <form onSubmit={submitMovement} className="product-form">
              <div className="form-grid">
                <div className="field-group">
                  <label htmlFor="movement-type">Movement type</label>
                  <select id="movement-type" value={movementType} onChange={(event) => setMovementType(event.target.value)}>
                    <option value="stock-in">Stock in / Purchase</option>
                    <option value="sale">Sale / Stock out</option>
                    <option value="damage">Damaged stock</option>
                    <option value="return">Customer return</option>
                    <option value="stock-out">Other stock out</option>
                    <option value="adjustment">Manual adjustment</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="movement-quantity">Quantity</label>
                  <input id="movement-quantity" type="number" step="1" value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} required />
                </div>
                <div className="field-group field-full">
                  <label htmlFor="movement-note">Note <span>Optional</span></label>
                  <input id="movement-note" value={movementNote} onChange={(event) => setMovementNote(event.target.value)} placeholder="Reason or reference" />
                </div>
              </div>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setMovementProduct(null)}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={isMoving}>
                  {isMoving ? 'Saving…' : 'Record movement'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{editingId ? 'UPDATE CATALOG' : 'NEW ITEM'}</p>
                <h2 id="product-form-title">{editingId ? 'Edit product' : 'Add a product'}</h2>
                <p>Product name and SKU are required.</p>
              </div>
              <button className="icon-button modal-close" onClick={() => setShowForm(false)} aria-label="Close form">×</button>
            </div>

            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-grid">
                <div className="field-group">
                  <label htmlFor="product-name">Product name</label>
                  <input id="product-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Organic whole milk" required />
                </div>
                <div className="field-group">
                  <label htmlFor="product-sku">SKU</label>
                  <input id="product-sku" name="sku" value={form.sku} onChange={handleChange} placeholder="e.g. DAIRY-001" required />
                </div>
                <div className="field-group">
                  <label htmlFor="product-barcode">Barcode <span>Optional</span></label>
                  <input id="product-barcode" name="barcode" value={form.barcode} onChange={handleChange} placeholder="e.g. 8901234567890" />
                </div>
                <div className="field-group">
                  <label htmlFor="product-category">Category <span>Optional</span></label>
                  <input id="product-category" name="category" value={form.category} onChange={handleChange} placeholder="e.g. Dairy" />
                </div>
                <div className="field-group">
                  <label htmlFor="product-brand">Brand <span>Optional</span></label>
                  <input id="product-brand" name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Fresh Farms" />
                </div>
                <div className="field-group field-full">
                  <label htmlFor="product-description">Description <span>Optional</span></label>
                  <input id="product-description" name="description" value={form.description} onChange={handleChange} placeholder="A short product description" />
                </div>
                <div className="field-group">
                  <label htmlFor="product-quantity">Quantity on hand</label>
                  <input id="product-quantity" type="number" min="0" step="1" name="quantity" value={form.quantity} onChange={handleChange} required />
                </div>
                <div className="field-group">
                  <label htmlFor="product-threshold">Reorder point <span>Default: {defaultThreshold}</span></label>
                  <input id="product-threshold" type="number" min="0" step="1" name="lowStockThreshold" value={form.lowStockThreshold} onChange={handleChange} placeholder={`Use default (${defaultThreshold})`} />
                </div>
                <div className="field-group">
                  <label htmlFor="product-cost">Cost price <span>Optional</span></label>
                  <input id="product-cost" type="number" min="0" step="0.01" name="costPrice" value={form.costPrice} onChange={handleChange} placeholder="0.00" />
                </div>
                <div className="field-group">
                  <label htmlFor="product-price">Selling price <span>Optional</span></label>
                  <input id="product-price" type="number" min="0" step="0.01" name="sellingPrice" value={form.sellingPrice} onChange={handleChange} placeholder="0.00" />
                </div>
              </div>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  )
}
