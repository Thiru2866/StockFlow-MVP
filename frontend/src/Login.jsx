import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import { readJsonResponse } from './api'

function Login() {
  const navigate = useNavigate()
  const [isSignup, setIsSignup] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setIsError(false)

    const email = event.target.email.value.trim()
    const password = event.target.password.value

    if (isSignup) {
      const organization = event.target.organization.value.trim()
      const confirmPassword = event.target.confirmPassword.value

      if (!organization) {
        setIsError(true)
        setMessage('Please enter organization name.')
        return
      }
      if (password !== confirmPassword) {
        setIsError(true)
        setMessage('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setIsError(true)
        setMessage('Password must contain at least 6 characters.')
        return
      }
    }

    try {
      setIsLoading(true)
      const body = isSignup
        ? { organization: event.target.organization.value.trim(), email, password }
        : { email, password }
      const response = await fetch(isSignup ? '/api/signup' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await readJsonResponse(response)

      if (!response.ok) {
        throw new Error(data.message || 'Request failed')
      }

      if (isSignup) {
        event.target.reset()
        setIsSignup(false)
        setIsError(false)
        setMessage(`${data.message || 'Registration successful!'} Please sign in with your new account.`)
      } else {
        localStorage.setItem('token', data.token)
        navigate('/dashboard')
      }
    } catch (error) {
      setIsError(true)
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a className="auth-brand" href="/" aria-label="StockFlow home">
          <span className="brand-mark">S</span>
          <strong>StockFlow</strong>
        </a>

        <div className="auth-content">
          <p className="eyebrow">INVENTORY, MADE SIMPLE</p>
          <h1>{isSignup ? 'Build a better stockroom.' : 'Welcome back.'}</h1>
          <p className="auth-intro">
            {isSignup
              ? 'Create your workspace and bring your inventory into focus.'
              : 'Sign in to see what’s in stock and what needs attention.'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && (
              <div className="field-group">
                <label htmlFor="organization">Organization name</label>
                <input id="organization" type="text" name="organization" placeholder="Your store or business" required />
              </div>
            )}
            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" name="email" placeholder="you@company.com" autoComplete="email" required />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" name="password" placeholder="At least 6 characters" autoComplete={isSignup ? 'new-password' : 'current-password'} required />
            </div>
            {isSignup && (
              <div className="field-group">
                <label htmlFor="confirm-password">Confirm password</label>
                <input id="confirm-password" type="password" name="confirmPassword" placeholder="Enter your password again" autoComplete="new-password" required />
              </div>
            )}

            {message && (
              <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`} role={isError ? 'alert' : 'status'}>
                {message}
              </div>
            )}

            <button className="button button-primary auth-submit" type="submit" disabled={isLoading}>
              {isLoading ? 'Please wait…' : isSignup ? 'Create your workspace' : 'Sign in'}
              {!isLoading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Already have a workspace?' : 'New to StockFlow?'}
            <button
              type="button"
              onClick={() => {
                setIsSignup((current) => !current)
                setMessage('')
                setIsError(false)
              }}
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-security"><span aria-hidden="true">◇</span> Your inventory is private to your organization.</p>
        </div>
      </section>

      <aside className="auth-showcase">
        <div className="showcase-orb orb-one" />
        <div className="showcase-orb orb-two" />
        <div className="showcase-copy">
          <span className="showcase-kicker"><i /> BUILT FOR YOUR BUSINESS</span>
          <h2>Know your stock.<br />Grow with confidence.</h2>
          <p>One calm, clear place to keep products and inventory in sync.</p>
        </div>
        <div className="preview-card">
          <div className="preview-topline">
            <span className="preview-mark">S</span>
            <span><strong>Inventory overview</strong><small>Workspace snapshot</small></span>
            <span className="preview-dots">•••</span>
          </div>
          <div className="preview-metrics">
            <div><small>Products</small><span className="preview-value-block" /></div>
            <div><small>Units in stock</small><span className="preview-value-block short" /></div>
          </div>
          <div className="preview-chart">
            <div className="preview-chart-head"><span>Stock levels</span><span className="preview-legend"><i /> In stock</span></div>
            <div className="preview-bars" aria-hidden="true">
              {[36, 54, 44, 72, 60, 84, 66, 94, 76, 100, 82, 91].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="preview-row"><span className="preview-row-icon">!</span><span><strong>Low stock alerts</strong><small>Stay ahead of reorder points</small></span><span className="preview-arrow">→</span></div>
        </div>
        <div className="showcase-footer"><span>StockFlow</span><span>Less guesswork. Better flow.</span></div>
      </aside>
    </main>
  )
}

export default Login
