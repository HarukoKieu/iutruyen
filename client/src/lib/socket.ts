/**
 * Socket.IO Client Singleton
 *
 * Initialises a single socket.io-client instance for the entire app.
 * The socket connects lazily on first call to `getSocket()` and re-uses
 * the same instance on subsequent calls (singleton pattern).
 *
 * Auth strategy: the server expects a JWT in `socket.handshake.auth.token`.
 * We read the current access token from `authStore` at connection time.
 * When the access token changes (e.g. after a silent refresh) call
 * `reconnectSocket()` to re-establish with the fresh token.
 */

import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/store/authStore'
import { SOCKET_URL } from './apiConfig'

let socket: Socket | null = null

/** Return the singleton socket, creating it if necessary. */
export const getSocket = (): Socket => {
  if (socket) return socket

  const accessToken = useAuthStore.getState().accessToken

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    auth: accessToken ? { token: accessToken } : undefined,
  })

  return socket
}

/** Connect the socket (idempotent — safe to call multiple times). */
export const connectSocket = (): void => {
  const s = getSocket()
  if (!s.connected) {
    // Refresh auth token before connecting
    const accessToken = useAuthStore.getState().accessToken
    if (accessToken) {
      s.auth = { token: accessToken }
    }
    s.connect()
  }
}

/** Disconnect and destroy the singleton so the next call rebuilds it. */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/**
 * Re-connect with a fresh access token (call after silent token refresh).
 */
export const reconnectSocket = (): void => {
  disconnectSocket()
  connectSocket()
}
