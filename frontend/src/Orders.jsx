import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('sale')
  const [partyName, setPartyName] = useState('')
  const [partyId, setPartyId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    try {
      const [orderData, productData, supplierData] = await Promise.all([
        api('/orders'),
        api('/products'),
        api('/suppliers')
      ])
      setOrders(orderData.orders)
      setProducts(productData.products)
      setSuppliers(supplierData.suppliers)
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([api('/orders'), api('/products'), api('/suppliers')])
      .then(([orderData, productData, supplierData]) => {
        if (!active) return
        setOrders(orderData.orders)
        setProducts(productData.products)
        setSuppliers(supplierData.suppliers)
      })
      .catch((err) => {
        if (active) {
          setIsError(true)
          setMessage(err.message)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const openForm = (orderType = 'sale') => {
    setType(orderType)
    setPartyName('')
    setPartyId('')
    setItems([])
    setNotes('')
    setSelectedProductId('')
    setQuantity('1')
    setPrice('')
    setShowForm(true)
    setMessage('')
  }

  const chooseParty = (value) => {
    setPartyId(value)
    if (type === 'purchase') {
      const supplier = suppliers.find((entry) => entry._id === value)
      setPartyName(supplier?.name || '')
    }
  }

  const selectProduct = (productId) => {
    setSelectedProductId(productId)
    const product = products.find((entry) => entry._id === productId)
    if (product) setPrice(String(type === 'purchase'
      ? (product.costPrice ?? '')
      : (product.sellingPrice ?? '')))
  }

  const addItem = () => {
    const product = products.find((entry) => entry._id === selectedProductId)
    const itemQuantity = Number(quantity)
    const itemPrice = Number(price)
    if (!product) {
      setIsError(true)
      setMessage('Select a product.')
      return
    }
    if (!Number.isSafeInteger(itemQuantity) || itemQuantity <= 0) {
      setIsError(true)
      setMessage('Quantity must be a positive whole number.')
      return
    }
    if (!Number.isFinite(itemPrice) || itemPrice < 0) {
      setIsError(true)
      setMessage('Enter a valid price.')
      return
    }
    setItems((current) => [...current.filter((item) => item.productId !== product._id), {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      quantity: itemQuantity,
      price: itemPrice
    }])
    setSelectedProductId('')
    setQuantity('1')
    setPrice('')
  }

  const submitOrder = async (event) => {
    event.preventDefault()
    if (!partyName.trim()) {
      setIsError(true)
      setMessage(type === 'purchase' ? 'Select a supplier.' : 'Enter a customer name.')
      return
    }
    if (items.length === 0) {
      setIsError(true)
      setMessage('Add at least one product.')
      return
    }
    try {
      await api('/orders', {
        method: 'POST',
        body: { type, partyName, partyId: type === 'purchase' ? partyId : null, items, notes }
      })
      setShowForm(false)
      setIsError(false)
      setMessage(`${type === 'purchase' ? 'Purchase' : 'Sale'} order completed.`)
      await loadData()
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    }
  }

  const deleteOrder = async (order) => {
    if (!window.confirm(`Reverse and delete this ${order.type} order?`)) return
    try {
      await api(`/orders/${order._id}`, { method: 'DELETE' })
      setIsError(false)
      setMessage('Order reversed and deleted.')
      await loadData()
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    }
  }

  const totalFor = (itemsForOrder) => itemsForOrder.reduce((sum, item) => sum + item.quantity * item.price, 0)

  return (
    <AppShell>
      <section className="page-heading">
        <div><p className="eyebrow">TRANSACTIONS</p><h1>Orders</h1><p className="page-subtitle">Record purchases and sales and update stock automatically.</p></div>
        <div className="toolbar-actions">
          <button className="button button-secondary" onClick={() => openForm('purchase')}>＋ Purchase order</button>
          <button className="button button-primary" onClick={() => openForm('sale')}>＋ Sale order</button>
        </div>
      </section>

      {message && <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      <section className="panel">
        {isLoading ? <div className="loading-card">Loading orders…</div> : orders.length === 0 ? (
          <div className="empty-state"><span className="empty-state-icon">▱</span><strong>No orders yet</strong><p>Create a purchase or sale order to update inventory.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Order</th><th>Type</th><th>Party</th><th>Items</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td><span className="sku-text">ORD-{order._id.slice(-6).toUpperCase()}</span></td>
                    <td><span className={`status-pill ${order.type === 'sale' ? 'status-healthy' : 'status-low'}`}>{order.type}</span></td>
                    <td><strong className="product-name-cell">{order.partyName}</strong></td>
                    <td>{order.items.length}</td>
                    <td>{totalFor(order.items).toLocaleString()}</td>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                    <td><button className="icon-button icon-button-danger" onClick={() => deleteOrder(order)} title="Reverse and delete">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop">
          <section className="product-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div><p className="eyebrow">{type.toUpperCase()} ORDER</p><h2>Create {type} order</h2></div>
              <button className="icon-button modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={submitOrder} className="product-form">
              {type === 'purchase' ? (
                <div className="field-group">
                  <label htmlFor="supplier-party">Supplier</label>
                  <select id="supplier-party" value={partyId} onChange={(event) => chooseParty(event.target.value)} required>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="field-group">
                  <label htmlFor="customer-party">Customer name</label>
                  <input id="customer-party" value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Customer or invoice name" required />
                </div>
              )}

              <div className="order-item-builder">
                <div className="field-group">
                  <label htmlFor="order-product">Product</label>
                  <select id="order-product" value={selectedProductId} onChange={(event) => selectProduct(event.target.value)}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku})</option>)}
                  </select>
                </div>
                <div className="field-group"><label htmlFor="order-quantity">Quantity</label><input id="order-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
                <div className="field-group"><label htmlFor="order-price">Unit price</label><input id="order-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
                <button type="button" className="button button-secondary" onClick={addItem}>Add item</button>
              </div>

              {items.length > 0 && (
                <table className="data-table order-items-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th /></tr></thead>
                  <tbody>{items.map((item) => (
                    <tr key={item.productId}><td>{item.name}</td><td>{item.quantity}</td><td>{item.price}</td><td>{item.quantity * item.price}</td><td><button type="button" className="icon-button" onClick={() => setItems((current) => current.filter((entry) => entry.productId !== item.productId))}>×</button></td></tr>
                  ))}</tbody>
                </table>
              )}

              <div className="field-group">
                <label htmlFor="order-notes">Notes</label>
                <input id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Invoice or purchase reference" />
              </div>
              <div className="order-total">Order total <strong>{items.reduce((sum, item) => sum + item.quantity * item.price, 0).toLocaleString()}</strong></div>
              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="button button-primary">Complete order</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  )
}
