import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

export default function Reports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/reports').then(setData).catch((err) => setError(err.message))
  }, [])

  const exportCsv = () => {
    if (!data) return
    const escape = (value) => {
      const text = value == null ? '' : String(value)
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows = [['Product','SKU','Quantity','Cost Price','Selling Price','Status'],
      ...data.lowStock.map((product) => [
        product.name, product.sku, product.quantity, product.costPrice ?? '',
        product.sellingPrice ?? '', 'Low stock'
      ])]
    const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'stockflow-low-stock-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell>
      <section className="page-heading">
        <div><p className="eyebrow">ANALYSIS</p><h1>Reports</h1><p className="page-subtitle">Inventory value, stock movement, and low-stock insights.</p></div>
        <button className="button button-primary" onClick={exportCsv} disabled={!data}>⇩ Export low-stock report</button>
      </section>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="loading-card">Loading reports…</div>}
      {data && (
        <>
          <section className="metrics-grid">
            {[['Total products', data.summary.totalProducts, 'Items in your catalog'],
              ['Total units', data.summary.totalUnits, 'Units currently on hand'],
              ['Low stock', data.summary.lowStockCount, 'Items needing attention']].map(([label, value, note]) =>
              <article className="metric-card" key={label}><p className="metric-label">{label}</p><div className="metric-value">{value}</div><p className="metric-note">{note}</p></article>)}
          </section>
          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">VALUATION</p><h2>Inventory value</h2></div></div>
              <div className="health-score"><strong>{data.summary.inventoryValue.toLocaleString()}</strong><span>cost value</span></div>
              <div className="threshold-note">Retail value: <strong>{data.summary.retailValue.toLocaleString()}</strong></div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">MOVEMENTS</p><h2>Recent activity</h2></div></div>
              <div className="health-score"><strong>+{data.summary.stockInUnits}</strong><span>stock in</span></div>
              <div className="health-score"><strong>-{data.summary.stockOutUnits}</strong><span>stock out</span></div>
            </article>
          </section>
          <section className="panel movement-history-panel">
            <div className="panel-heading"><div><p className="eyebrow">RESTOCKING</p><h2>Low stock items</h2></div></div>
            {data.lowStock.length === 0 ? <div className="empty-state"><strong>No low-stock items</strong></div> :
              <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Reorder point</th></tr></thead><tbody>
                {data.lowStock.map((product) => <tr key={product._id}><td><strong className="product-name-cell">{product.name}</strong></td><td>{product.sku}</td><td className="quantity-low">{product.quantity}</td><td>{product.lowStockThreshold ?? 'Default'}</td></tr>)}
              </tbody></table></div>}
          </section>
        </>
      )}
    </AppShell>
  )
}
