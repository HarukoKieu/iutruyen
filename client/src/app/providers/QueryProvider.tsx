import React from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

interface QueryProviderProps {
  client?: QueryClient
  children: React.ReactNode
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children, client = queryClient }) => {
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}

export default QueryProvider
