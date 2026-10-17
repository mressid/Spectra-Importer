import { useState } from 'react'
import { isLoggedIn, login } from '../upload/api'

interface StepConnectProps {
  onConnected: (email: string) => void
}

export function StepConnect({ onConnected }: StepConnectProps) {
  const [email, setEmail] = useState('admin@store.local')
  const [password, setPassword] = useState('admin_password')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectedUser, setConnectedUser] = useState<string | null>(
    isLoggedIn() ? 'admin@store.local' : null,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      setConnectedUser(email)
      onConnected(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>1. Connect to Store</h2>
      <p style={{ color: 'var(--ds-color-text-secondary)' }}>
        Authenticate with the store backend. In local development, calls to <code>/api</code> are proxied to the store API.
      </p>

      {connectedUser ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="badge success" style={{ alignSelf: 'flex-start' }}>
            Connected as {connectedUser}
          </div>
          <p>You are authenticated and ready to manage imports.</p>
          <div>
            <button className="primary" type="button" onClick={() => onConnected(connectedUser)}>
              Continue to Images
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          {error && (
            <div className="badge error" style={{ padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email">Admin or Staff Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
