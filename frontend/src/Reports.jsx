import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

const colors = ['#3970e6', '#39ad83', '#e3a23b', '#8b72dc', '#e27168', '#40a9bd']
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

function BarChart({ data, firstKey, secondKey, firstLabel, secondLabel }) {
  const max = Math.max(1, ...data.flatMap((item) => [item[firstKey], item[secondKey]]))
  const chartHeight = 170
  const groupWidth = 700 / Math.max(data.length, 1)
  const barWidth = Math.min(15, groupWidth * 0.3)

  return (
    <>
      <div className="chart-legend">
        <span><i style={{ background: colors[0] }} />{firstLabel}</span>
        <span><i style={{ background: colors[1] }} />{secondLabel}</span>
      </div>
      <div className="chart-scroll">
        <svg className="chart-svg" viewBox="0 0 700 220" role="img" aria-label={`${firstLabel} and ${secondLabel} by month`}>
          {[0, 1, 2, 3].map((line) => {
            const y = 12 + (chartHeight / 3) * line
            return <line key={line} x1="30" x2="690" y1={y} y2={y} className="chart-gridline" />
          })}
          {data.map((item, index) => {
            const center = 40 + groupWidth * index + groupWidth / 2
            const firstHeight = (item[firstKey] / max) * chartHeight
            const secondHeight = (item[secondKey] / max) * chartHeight
            return (
              <g key={item.label}>
                <rect x={center - barWidth - 1} y={182 - firstHeight} width={barWidth} height={firstHeight} rx="3" fill={colors[0]} />
                <rect x={center + 1} y={182 - secondHeight} width={barWidth} height={secondHeight} rx="3" fill={colors[1]} />
                {(index % 2 === 0 || index === data.length - 1) && (
                  <text x={center} y="207" textAnchor="middle" className="chart-axis-label">{item.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="chart-footnote">Last 12 months</div>
    </>
  )
}

function LineChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const points = data.map((item, index) => ({
    ...item,
    x: 34 + (632 / Math.max(1, data.length - 1)) * index,
    y: 180 - (item.value / max) * 150
  }))

  return (
    <div className="chart-scroll">
      <svg className="chart-svg" viewBox="0 0 700 220" role="img" aria-label="Estimated inventory value over the last 12 months">
        {[0, 1, 2, 3].map((line) => {
          const y = 30 + line * 50
          return <line key={line} x1="30" x2="680" y1={y} y2={y} className="chart-gridline" />
        })}
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={colors[0]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke={colors[0]} strokeWidth="2" />
            {(index % 2 === 0 || index === points.length - 1) && (
              <text x={point.x} y="207" textAnchor="middle" className="chart-axis-label">{point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function CategoryChart({ categories }) {
  const max = Math.max(1, ...categories.map((category) => category.value))
  if (!categories.length) return <div className="chart-empty">Add products to see category distribution.</div>
  return (
    <div className="category-chart">
      {categories.slice(0, 8).map((category, index) => (
        <div className="category-chart-row" key={category.category}>
          <div className="category-chart-label"><span>{category.category}</span><strong>{category.products} {category.products === 1 ? 'product' : 'products'}</strong></div>
          <div className="category-bar-track"><span style={{ width: `${Math.max(2, (category.value / max) * 100)}%`, background: colors[index % colors.length] }} /></div>
          <small>{numberFormat.format(category.value)} value · {numberFormat.format(category.units)} units</small>
        </div>
      ))}
    </div>
  )
}

function StockHealthChart({ stockHealth }) {
  const values = [
    { label: 'Healthy', value: stockHealth.healthy, color: colors[1] },
    { label: 'Low stock', value: stockHealth.low, color: colors[2] },
    { label: 'Out of stock', value: stockHealth.outOfStock, color: colors[4] }
  ]
  const total = values.reduce((sum, item) => sum + item.value, 0)
  let position = 0
  const gradient = total
    ? values.map((item) => {
      const start = position
      position += (item.value / total) * 100
      return `${item.color} ${start}% ${position}%`
    }).join(', ')
    : '#e8edf4 0 100%'

  return (
    <div className="health-chart-wrap">
      <div className="health-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div><strong>{total}</strong><span>products</span></div>
      </div>
      <div className="health-chart-legend">
        {values.map((item) => <div key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
    </div>
  )
}

function TopSellingChart({ products }) {
  const max = Math.max(1, ...products.map((product) => product.quantity))
  if (!products.length) return <div className="chart-empty">Complete sale orders to see top-selling products.</div>
  return (
    <div className="category-chart">
      {products.map((product, index) => (
        <div className="category-chart-row" key={`${product.sku}-${index}`}>
          <div className="category-chart-label"><span>{product.name}</span><strong>{numberFormat.format(product.quantity)} sold</strong></div>
          <div className="category-bar-track"><span style={{ width: `${Math.max(2, (product.quantity / max) * 100)}%`, background: colors[index % colors.length] }} /></div>
          <small>{product.sku} · Revenue {numberFormat.format(product.revenue)}</small>
        </div>
      ))}
    </div>
  )
}

function ChartPanel({ eyebrow, title, children, className = '' }) {
  return (
    <article className={`panel report-chart-panel ${className}`}>
      <div className="panel-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      </div>
      {children}
    </article>
  )
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api('/reports')
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => { active = false }
  }, [])

  const exportCsv = () => {
    if (!data) return
    const escape = (value) => {
      const text = value == null ? '' : String(value)
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows = [['Product', 'SKU', 'Quantity', 'Cost Price', 'Selling Price', 'Status'],
      ...data.lowStock.map((product) => [
        product.name, product.sku, product.quantity, product.costPrice ?? '',
        product.sellingPrice ?? '', product.quantity === 0 ? 'Out of stock' : 'Low stock'
      ])]
    const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'stockflow-low-stock-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const chartData = data?.charts

  return (
    <AppShell>
      <section className="page-heading">
        <div><p className="eyebrow">ANALYSIS</p><h1>Reports</h1><p className="page-subtitle">Visualize inventory, stock movement, and sales trends.</p></div>
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
              <article className="metric-card" key={label}><p className="metric-label">{label}</p><div className="metric-value">{numberFormat.format(value)}</div><p className="metric-note">{note}</p></article>)}
          </section>

          <section className="reports-chart-grid">
            <ChartPanel eyebrow="STOCK MOVEMENT" title="Stock-in vs. stock-out" className="report-chart-wide">
              <BarChart data={chartData.movementTrend} firstKey="stockIn" secondKey="stockOut" firstLabel="Stock in" secondLabel="Stock out" />
            </ChartPanel>
            <ChartPanel eyebrow="ORDER VALUE" title="Sales vs. purchases" className="report-chart-wide">
              <BarChart data={chartData.salesAndPurchases} firstKey="sales" secondKey="purchases" firstLabel="Sales" secondLabel="Purchases" />
            </ChartPanel>
            <ChartPanel eyebrow="INVENTORY MIX" title="Value by category">
              <CategoryChart categories={chartData.categories} />
            </ChartPanel>
            <ChartPanel eyebrow="STOCK HEALTH" title="Current stock status">
              <StockHealthChart stockHealth={chartData.stockHealth} />
            </ChartPanel>
            <ChartPanel eyebrow="BEST SELLERS" title="Top-selling products">
              <TopSellingChart products={chartData.topSelling} />
            </ChartPanel>
            <ChartPanel eyebrow="INVENTORY VALUE" title="Estimated value trend" className="report-chart-wide">
              <LineChart data={chartData.inventoryValueTrend} />
              <p className="chart-footnote">Historical values are estimates using recorded stock movements and current product cost prices.</p>
            </ChartPanel>
          </section>

          <section className="dashboard-grid reports-summary-grid">
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">VALUATION</p><h2>Current inventory value</h2></div></div>
              <div className="health-score"><strong>{numberFormat.format(data.summary.inventoryValue)}</strong><span>cost value</span></div>
              <div className="threshold-note">Retail value: <strong>{numberFormat.format(data.summary.retailValue)}</strong></div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">MOVEMENTS</p><h2>Last 12 months</h2></div></div>
              <div className="health-score"><strong>+{numberFormat.format(data.summary.stockInUnits)}</strong><span>stock in</span></div>
              <div className="health-score"><strong>-{numberFormat.format(data.summary.stockOutUnits)}</strong><span>stock out</span></div>
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
