import { useState } from 'react'
import { DISPLAY_MODES, type DisplayMode } from './displayMode'
import { getCurrentUserEmail, isLoggedIn, login, logout } from '../upload/api'
import { IconArrowRight, IconLink, IconUnlink } from './Icons'

interface StepConnectProps {
  onConnected: (email: string) => void
  onDisconnected: () => void
  displayMode: DisplayMode
  onDisplayModeChange: (mode: DisplayMode) => void
}

export function StepConnect({ onConnected, onDisconnected, displayMode, onDisplayModeChange }: StepConnectProps) {
  const [email, setEmail] = useState('admin@store.local')
  const [password, setPassword] = useState('admin_password')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectedUser, setConnectedUser] = useState<string | null>(
    isLoggedIn() ? getCurrentUserEmail() : null,
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

  const handleLogout = () => {
    logout()
    setConnectedUser(null)
    onDisconnected()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <h2>Connection</h2>
        <p style={{ color: 'var(--ds-color-text-secondary)' }}>
          Sign in with the store's admin or staff account.
        </p>

        {connectedUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Connected as {connectedUser}</span>
              <button className="small danger" type="button" onClick={handleLogout}>
                <IconUnlink size={14} />
                Disconnect
              </button>
            </div>
            <p>You are authenticated and ready to manage imports.</p>
            <div>
              <button className="primary" type="button" onClick={() => onConnected(connectedUser)}>
                <IconArrowRight size={16} />
                Go to Dashboard Overview
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          {error && (
            <div className="badge error">
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
              <IconLink size={16} />
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      )}
      </div>


      <div className="card">
        <h2>Display</h2>
        <p className="muted-line">How buttons and menus are drawn.</p>
        <div role="group" aria-label="Display" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`keep-text small${displayMode === mode.id ? ' primary' : ''}`}
              aria-pressed={displayMode === mode.id}
              onClick={() => onDisplayModeChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
