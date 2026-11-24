import { useEffect, useState } from 'react'
import { AppShell } from './Navbar'
import { api } from './api'

export default function Settings() {
  const [threshold, setThreshold] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true
    api('/settings')
      .then((data) => {
        if (active) setThreshold(String(data.defaultLowStockThreshold))
      })
      .catch((err) => {
        if (!active) return
        setIsError(true)
        setMessage(err.message)
      })

    return () => {
      active = false
    }
  }, [])

  const handleSave = async (event) => {
    event.preventDefault()
    setMessage('')
    setIsSaving(true)

    try {
      const data = await api('/settings', {
        method: 'PUT',
        body: { defaultLowStockThreshold: Number(threshold) }
      })
      setThreshold(String(data.defaultLowStockThreshold))
      setIsError(false)
      setMessage('Your inventory settings have been updated.')
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h1>Settings</h1>
          <p className="page-subtitle">Set the defaults used to monitor your inventory.</p>
        </div>
      </section>

      <section className="settings-layout">
        <article className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-icon" aria-hidden="true">⚙</span>
            <div>
              <h2>Stock alerts</h2>
              <p>Choose when a product should be marked as low stock.</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="settings-form">
            <label htmlFor="low-stock-threshold">Default reorder point</label>
            <p className="field-help">
              Products without their own reorder point use this number.
            </p>
            <div className="threshold-input-row">
              <input
                id="low-stock-threshold"
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                required
              />
              <span>units</span>
            </div>
            <div className="settings-form-footer">
              <span>Applies to products with no custom threshold.</span>
              <button className="button button-primary" type="submit" disabled={isSaving || threshold === ''}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
          {message && (
            <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`} role={isError ? 'alert' : 'status'}>
              {message}
            </div>
          )}
        </article>

        <aside className="settings-aside">
          <span className="aside-sparkle" aria-hidden="true">✦</span>
          <h2>Make every count matter</h2>
          <p>Set a reorder point that gives you enough time to replenish products before they run out.</p>
        </aside>
      </section>
    </AppShell>
  )
}
