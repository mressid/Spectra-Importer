import { useEffect, useRef } from 'react'
import { checkAndRefreshToken } from '../upload/api'

const EVERY_MS = 30_000

/**
 * While connected, checks the login every 30 s and renews it when it is about to expire. Says nothing when it works;
 * when the login cannot be kept, `onLost` is called and the connection indicator shows it.
 */
export function useTokenKeepAlive(connectedUser: string | null, onLost: () => void): void {
  const lost = useRef(onLost)
  useEffect(() => {
    lost.current = onLost
  })

  useEffect(() => {
    if (!connectedUser) return
    const id = setInterval(() => {
      checkAndRefreshToken()
        .then((result) => {
          if (!result.valid) lost.current()
        })
        .catch(() => lost.current())
    }, EVERY_MS)
    return () => clearInterval(id)
  }, [connectedUser])
}
