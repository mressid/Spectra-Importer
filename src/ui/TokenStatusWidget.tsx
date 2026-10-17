import { useCallback, useEffect, useState } from 'react'
import { checkAndRefreshToken } from '../upload/api'
import {
  IconAlertCircle,
  IconCheckCircle,
  IconClock,
  IconRefresh,
  IconXCircle,
} from './Icons'

interface TokenStatusWidgetProps {
  connectedUser: string | null
  onAuthChange?: (email: string | null) => void
  compact?: boolean
}

type TokenState = 'idle' | 'valid' | 'refreshed' | 'expired' | 'checking'

export function TokenStatusWidget({
  connectedUser,
  onAuthChange,
  compact = false,
}: TokenStatusWidgetProps) {
  const [tokenState, setTokenState] = useState<TokenState>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [isPeriodic, setIsPeriodic] = useState<boolean>(true)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  const handleCheck = useCallback(async () => {
    if (isChecking) return
    setIsChecking(true)
    setTokenState('checking')

    try {
      const res = await checkAndRefreshToken()
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setLastChecked(timeStr)
      setStatusMessage(res.message)

      if (res.valid) {
        setTokenState(res.refreshed ? 'refreshed' : 'valid')
        if (res.userEmail && onAuthChange) {
          onAuthChange(res.userEmail)
        }
      } else {
        setTokenState('expired')
        if (onAuthChange) {
          onAuthChange(null)
        }
      }
    } catch (err) {
      setTokenState('expired')
      setStatusMessage(err instanceof Error ? err.message : 'Token verification failed')
      if (onAuthChange) {
        onAuthChange(null)
      }
    } finally {
      setIsChecking(false)
    }
  }, [isChecking, onAuthChange])

  // Periodic interval effect (every 30 seconds when enabled and connected)
  useEffect(() => {
    if (!isPeriodic || !connectedUser) return

    const intervalId = setInterval(() => {
      handleCheck()
    }, 30000)

    return () => clearInterval(intervalId)
  }, [isPeriodic, connectedUser, handleCheck])

  // Compact mode for Dashboard Topbar
  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {tokenState === 'valid' && (
          <span className="badge success" title={statusMessage || 'Token is valid'}>
            <IconCheckCircle size={12} />
            Token Valid
          </span>
        )}
        {tokenState === 'refreshed' && (
          <span className="badge info" title={statusMessage}>
            <IconRefresh size={12} />
            Token Refreshed
          </span>
        )}
        {tokenState === 'expired' && (
          <span className="badge error" title={statusMessage}>
            <IconXCircle size={12} />
            Token Expired
          </span>
        )}
        {tokenState === 'checking' && (
          <span className="badge warning">
            <IconClock size={12} className="spin" />
            Checking...
          </span>
        )}

        <button
          className="small"
          type="button"
          onClick={handleCheck}
          disabled={isChecking || !connectedUser}
          title={lastChecked ? `Last checked: ${lastChecked}` : 'Verify and refresh token if needed'}
          style={{ gap: '4px' }}
        >
          <IconRefresh size={13} className={isChecking ? 'spin' : ''} />
          Check Token
        </button>

        <button
          className={`small ${isPeriodic ? 'primary' : ''}`}
          type="button"
          onClick={() => setIsPeriodic(!isPeriodic)}
          title={isPeriodic ? 'Auto-check every 30s is active' : 'Click to enable 30s auto-check'}
          style={{ gap: '4px' }}
        >
          <IconClock size={13} />
          {isPeriodic ? 'Auto 30s: ON' : 'Auto: OFF'}
        </button>
      </div>
    )
  }

  // Expanded card view for Dashboard Overview / Store Settings
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconRefresh size={18} style={{ color: 'var(--ds-color-primary)' }} />
            API Token Health & Auto-Refresh
          </h3>
          <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-small)', margin: 0 }}>
            Verifies access token with the store and renews it automatically via <code>/api/v1/auth/refresh</code> when expired.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="primary small"
            type="button"
            onClick={handleCheck}
            disabled={isChecking || !connectedUser}
            style={{ gap: '6px' }}
          >
            <IconRefresh size={14} className={isChecking ? 'spin' : ''} />
            {isChecking ? 'Checking...' : 'Check & Refresh Token'}
          </button>

          <button
            className={`small ${isPeriodic ? 'primary' : ''}`}
            type="button"
            onClick={() => setIsPeriodic(!isPeriodic)}
            style={{ gap: '6px' }}
          >
            <IconClock size={14} />
            {isPeriodic ? 'Auto-Check: Active (30s)' : 'Auto-Check: Paused'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          marginTop: '16px',
          padding: '12px',
          background: 'var(--ds-color-surface-muted)',
          borderRadius: 'var(--ds-radius-inner)',
          border: '1px solid var(--ds-color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Status:
          </span>
          {tokenState === 'valid' && (
            <span className="badge success">
              <IconCheckCircle size={12} />
              Valid & Active
            </span>
          )}
          {tokenState === 'refreshed' && (
            <span className="badge info">
              <IconRefresh size={12} />
              Refreshed Successfully
            </span>
          )}
          {tokenState === 'expired' && (
            <span className="badge error">
              <IconXCircle size={12} />
              Session Expired
            </span>
          )}
          {tokenState === 'checking' && (
            <span className="badge warning">
              <IconClock size={12} className="spin" />
              Verifying with Store...
            </span>
          )}
          {tokenState === 'idle' && (
            <span className="badge">
              {connectedUser ? 'Connected' : 'Offline'}
            </span>
          )}
        </div>

        {lastChecked && (
          <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)' }}>
            Last verified: <strong>{lastChecked}</strong>
          </div>
        )}

        {statusMessage && (
          <div style={{ fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-text-secondary)', flex: 1 }}>
            {statusMessage}
          </div>
        )}

        {!connectedUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--ds-font-size-caption)', color: 'var(--ds-color-warning)' }}>
            <IconAlertCircle size={14} />
            Log in to enable token verification.
          </div>
        )}
      </div>
    </div>
  )
}
