import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  quantity: '0',
  costPrice: '',
  sellingPrice: '',
  lowStockThreshold: ''
}

const fetchInventory = () => Promise.all([
  api('/products'),
  api('/settings')
])

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

  const showMessage = (text, error = false) => {
    setMessage(text)
    setIsError(error)
  }

  const loadData = async () => {
    try {
      const [productData, settingsData] = await fetchInventory()
      setProducts(productData.products)
      setDefaultThreshold(settingsData.defaultLowStockThreshold)
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
      description: product.description || '',
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
      description: form.description,
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
    const quantity = product.quantity + change
    if (quantity < 0) return

    setBusyProductId(product._id)
    try {
      await api(`/products/${product._id}`, {
        method: 'PUT',
        body: { quantity }
      })
      await loadData()
      showMessage('Stock level updated.')
    } catch (err) {
      showMessage(err.message, true)
    } finally {
      setBusyProductId(null)
    }
  }

  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = product.name.toLowerCase().includes(query)
      || product.sku.toLowerCase().includes(query)
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
                  <th>SKU</th>
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
                      <td><span className="sku-text">{product.sku}</span></td>
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
