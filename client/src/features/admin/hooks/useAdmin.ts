import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { adminApi } from '../api/admin.api'
import type { AdminAction, ActionPayload } from '../types'
import { queryKeys } from '@/constants/queryKeys'

/** Private query keys bind the actor and are purged when identity/role changes. */
export function useAdminQuery<T>(name: string, params: object, fetcher: (signal: AbortSignal) => Promise<T>) {
  const user = useAuthStore(state => state.user)
  return useQuery({ queryKey: queryKeys.admin.scoped(user?.id, name, params), queryFn: ({ signal }) => fetcher(signal), enabled: user?.role === 'admin', staleTime: 10000, retry: false })
}
/** Receipts/passwords stay in transient memory; callers reset mutation state after completion. */
export function useAdminAction() {
  const client = useQueryClient()
  return useMutation({ gcTime: 0, retry: false,
    mutationFn: ({ id, action, payload, password }: { id: string; action: AdminAction; payload: ActionPayload; password: string }) => adminApi.act(id, action, payload, password),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin'] }) },
  })
}
export function adminError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message ?? (error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.')
}
