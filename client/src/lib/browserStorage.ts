import type { StateStorage } from 'zustand/middleware'

/** Persistence is optional: denied/full storage must not disable the in-memory UI. */
export const browserStorage: StateStorage = {
  getItem: name => {
    try { return localStorage.getItem(name) } catch { return null }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value) } catch { /* memory state remains usable */ }
  },
  removeItem: name => {
    try { localStorage.removeItem(name) } catch { /* storage may be unavailable */ }
  },
}

/** Session persistence is optional too; accessing the storage object can itself throw. */
export const browserSessionStorage: StateStorage = {
  getItem: name => {
    try { return sessionStorage.getItem(name) } catch { return null }
  },
  setItem: (name, value) => {
    try { sessionStorage.setItem(name, value) } catch { /* consent remains in memory */ }
  },
  removeItem: name => {
    try { sessionStorage.removeItem(name) } catch { /* storage may be unavailable */ }
  },
}
