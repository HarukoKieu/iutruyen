import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { QueryProvider } from './providers/QueryProvider'
import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import MatureConfirmationProvider from '@/features/stories/components/MatureConfirmationProvider'
export function App({ children, client }: { children: ReactNode; client: QueryClient }) {
  useEffect(() => {
    void useAuthStore.persist.rehydrate()
    void useReaderSettingsStore.persist.rehydrate()
  }, [])
  return <ThemeProvider attribute="class" themes={['light', 'soft-blue', 'sepia', 'dark']} defaultTheme="light" enableSystem={false}>
    <QueryProvider client={client}><MatureConfirmationProvider>{children}</MatureConfirmationProvider><Toaster richColors closeButton /></QueryProvider>
  </ThemeProvider>
}
export default App
