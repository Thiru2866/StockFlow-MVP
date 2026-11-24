import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from './Navbar'
import { api } from './api'

function MetricCard({ label, value, note, icon, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`} aria-hidden="true">{icon}</div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}</div>
      <p className="metric-note">{note}</p>
    </article>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api('/dashboard')
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })

    return () => {
      active = false
    }
  }, [])

  const healthyProducts = data
    ? Math.max(0, data.totalProducts - data.lowStock.length)
    : 0
  const healthyPercentage = data?.totalProducts
    ? Math.round((healthyProducts / data.totalProducts) * 100)
    : 0

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="page-subtitle">A clear view of your products and stock levels.</p>
        </div>
        <Link className="button button-primary" to="/products">
          <span aria-hidden="true">＋</span> Manage inventory
        </Link>
      </section>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!data && !error && <div className="loading-card">Loading your inventory…</div>}

      {data && (
        <>
          <section className="metrics-grid" aria-label="Inventory summary">
            <MetricCard
              label="Total products"
              value={data.totalProducts.toLocaleString()}
              note="Unique items in your catalog"
              icon="▤"
              tone="blue"
            />
            <MetricCard
              label="Units in stock"
              value={data.totalQuantity.toLocaleString()}
              note="Across all products"
              icon="▦"
              tone="violet"
            />
            <MetricCard
              label="Low stock items"
              value={data.lowStock.length.toLocaleString()}
              note={data.lowStock.length ? 'Needs your attention' : 'Everything is above its reorder point'}
              icon="!"
              tone={data.lowStock.length ? 'amber' : 'green'}
            />
          </section>

          <section className="dashboard-grid">
            <article className="panel low-stock-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">RESTOCKING</p>
                  <h2>Low stock items</h2>
                </div>
                <Link className="text-link" to="/products">View inventory <span aria-hidden="true">→</span></Link>
              </div>

              {data.lowStock.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon" aria-hidden="true">✓</span>
                  <strong>You’re all caught up</strong>
                  <p>No products are currently below their reorder point.</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>On hand</th>
                        <th>Reorder point</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((product) => (
                        <tr key={product._id}>
                          <td className="product-name-cell">{product.name}</td>
                          <td><span className="sku-text">{product.sku}</span></td>
                          <td><strong className="quantity-low">{product.quantity}</strong></td>
                          <td>{product.effectiveThreshold}</td>
                          <td><span className="status-pill status-low">Reorder</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="panel stock-health-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STOCK HEALTH</p>
                  <h2>Inventory status</h2>
                </div>
                <span className="health-mark" aria-hidden="true">↗</span>
              </div>
              <div className="health-score">
                <strong>{healthyPercentage}%</strong>
                <span>of products are above their reorder point</span>
              </div>
              <div
                className="health-track"
                role="progressbar"
                aria-label="Products above reorder point"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={healthyPercentage}
              >
                <span style={{ width: `${healthyPercentage}%` }} />
              </div>
              <div className="health-legend">
                <span><i className="legend-dot legend-healthy" /> Healthy <strong>{healthyProducts}</strong></span>
                <span><i className="legend-dot legend-low" /> Low stock <strong>{data.lowStock.length}</strong></span>
              </div>
              <div className="threshold-note">
                <span aria-hidden="true">ⓘ</span>
                Default reorder point: <strong>{data.defaultLowStockThreshold} units</strong>
              </div>
            </article>
          </section>
        </>
      )}
    </AppShell>
  )
}
