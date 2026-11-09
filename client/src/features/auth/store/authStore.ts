import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/user'
import { browserStorage } from '@/lib/browserStorage'

import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import { queryClient } from '@/lib/queryClient'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  setHydrated: () => void
  setAccessToken: (token: string | null) => void
  setUser: (user: User | null) => void
  setAuth: (user: User, accessToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      setHydrated: () => set({ hasHydrated: true }),
      setAccessToken: (accessToken) =>
        set({
          accessToken,
          isAuthenticated: !!accessToken,
        }),
      setUser: (user) => {
        if (get().user?.id !== user?.id || get().user?.role !== user?.role) queryClient.removeQueries({ queryKey: ['admin'] })
        set({ user })
      },
      setAuth: (user, accessToken) => {
        if (get().user?.id !== user.id) queryClient.clear()
        else if (get().user?.role !== user.role) queryClient.removeQueries({ queryKey: ['admin'] })
        set({ user, accessToken, isAuthenticated: true })
      },
      logout: () => {
        if (!get().isAuthenticated && !get().user && !get().accessToken) return
        set({ user: null, accessToken: null, isAuthenticated: false })
        queryClient.clear()
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('theme', 'light')
            document.documentElement.classList.remove('dark', 'soft-blue', 'sepia')
            document.documentElement.classList.add('light')
            useReaderSettingsStore.getState().setTheme('light')
          }
        } catch {
          // ignore
        }
      },
    }),
    {
      skipHydration: true,
      // Release dependent queries on success and malformed/unavailable storage.
      onRehydrateStorage: () => () => useAuthStore.getState().setHydrated(),
      name: 'auth-storage',
      storage: createJSONStorage(() => browserStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
