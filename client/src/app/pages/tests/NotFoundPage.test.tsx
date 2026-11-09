import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotFoundPage } from '../NotFoundPage'

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('NotFoundPage', () => {
  it('renders 404 badge and guidance links correctly', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <NotFoundPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Trang không tồn tại')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Trang chủ/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tủ sách của tôi/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Khám phá truyện/i })).toBeInTheDocument()
  })
})
