import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

const emptyForm = { name: '', contactName: '', email: '', phone: '', address: '', notes: '' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadSuppliers = async () => {
    try {
      const data = await api('/suppliers')
      setSuppliers(data.suppliers)
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api('/suppliers')
      .then((data) => {
        if (active) setSuppliers(data.suppliers)
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

    return () => {
      active = false
    }
  }, [])

  const openForm = (supplier = null) => {
    setEditingId(supplier?._id || null)
    setForm(supplier ? {
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    } : emptyForm)
    setShowForm(true)
    setMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      if (editingId) {
        await api(`/suppliers/${editingId}`, { method: 'PUT', body: form })
      } else {
        await api('/suppliers', { method: 'POST', body: form })
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      setIsError(false)
      setMessage(editingId ? 'Supplier updated.' : 'Supplier added.')
      await loadSuppliers()
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    }
  }

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return
    try {
      await api(`/suppliers/${supplier._id}`, { method: 'DELETE' })
      setMessage('Supplier deleted.')
      setIsError(false)
      await loadSuppliers()
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    }
  }

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PURCHASING</p>
          <h1>Suppliers</h1>
          <p className="page-subtitle">Manage contacts and sources for your inventory.</p>
        </div>
        <button className="button button-primary" onClick={() => openForm()}>＋ Add supplier</button>
      </section>

      {message && <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      <section className="panel">
        {isLoading ? (
          <div className="loading-card">Loading suppliers…</div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">♙</span>
            <strong>No suppliers yet</strong>
            <p>Add suppliers to keep purchase contacts organized.</p>
            <button className="button button-primary" onClick={() => openForm()}>Add your first supplier</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier._id}>
                    <td><strong className="product-name-cell">{supplier.name}</strong>{supplier.address && <><br /><small>{supplier.address}</small></>}</td>
                    <td>{supplier.contactName || '—'}</td>
                    <td>{supplier.email || '—'}</td>
                    <td>{supplier.phone || '—'}</td>
                    <td><div className="row-actions">
                      <button className="icon-button" onClick={() => openForm(supplier)} title="Edit">✎</button>
                      <button className="icon-button icon-button-danger" onClick={() => handleDelete(supplier)} title="Delete">×</button>
                    </div></td>
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
              <div><p className="eyebrow">SUPPLIER DETAILS</p><h2>{editingId ? 'Edit supplier' : 'Add supplier'}</h2></div>
              <button className="icon-button modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-grid">
                {[
                  ['name', 'Supplier name', 'e.g. Fresh Farms Supply', true],
                  ['contactName', 'Contact name', 'e.g. Arun Kumar', false],
                  ['email', 'Email', 'supplier@example.com', false],
                  ['phone', 'Phone', 'e.g. +91 98765 43210', false],
                  ['address', 'Address', 'Supplier address', false]
                ].map(([field, label, placeholder, required]) => (
                  <div className="field-group" key={field}>
                    <label htmlFor={`supplier-${field}`}>{label}</label>
                    <input id={`supplier-${field}`} name={field} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={placeholder} required={required} />
                  </div>
                ))}
                <div className="field-group field-full">
                  <label htmlFor="supplier-notes">Notes</label>
                  <input id="supplier-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Payment terms or purchase notes" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="button button-primary">{editingId ? 'Save changes' : 'Add supplier'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  )
}
