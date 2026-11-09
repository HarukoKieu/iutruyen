// The dev server proxies these paths to the configured backend. Using the
// browser's origin keeps LAN and tunnel clients from connecting to themselves.
const isBrowserDevelopment = import.meta.env.DEV && typeof window !== 'undefined'

export const API_BASE_URL = isBrowserDevelopment
  ? '/api/v1'
  : import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'

export const SOCKET_URL = isBrowserDevelopment
  ? window.location.origin
  : import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'
