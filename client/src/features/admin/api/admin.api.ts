import { api } from '@/lib/axios'
import type { AdminUser, AdminStory, AuditItem, Page, Overview, Chart, SiteConfig, AdminAction, ActionPayload, Backups, BackupItem } from '../types'

const get = async <T>(path: string, params?: object, signal?: AbortSignal) => (await api.get<{ data: T }>(`/admin/${path}`, { params, signal, timeout: 10000 })).data.data
const page = async <T>(path: string, params: object, signal?: AbortSignal) => (await api.get<Page<T>>(`/admin/${path}`, { params, signal, timeout: 10000 })).data
export const adminApi = {
  overview: (signal?: AbortSignal) => get<Overview>('dashboard/overview', undefined, signal),
  charts: (params: { metric: string; from: string; to: string }, signal?: AbortSignal) => get<Chart>('dashboard/charts', params, signal),
  users: (params: object, signal?: AbortSignal) => page<AdminUser>('users', params, signal),
  stories: (params: object, signal?: AbortSignal) => page<AdminStory>('stories', params, signal),
  audit: (params: object, signal?: AbortSignal) => page<AuditItem>('audit-logs', params, signal),
  config: (signal?: AbortSignal) => get<SiteConfig>('config', undefined, signal),
  saveConfig: async (input: Omit<SiteConfig, 'version'> & { expectedVersion: number; reason: string }) => (await api.put<{ data: SiteConfig }>('/admin/config', input, { timeout: 20000 })).data.data,
  async act(targetId: string, action: AdminAction, payload: ActionPayload, password: string) {
    const confirmation = await api.post<{ data: { actionReceipt: string } }>('/admin/action-confirmations', { targetId, action, payload, password }, { timeout: 10000 })
    return (await api.patch<{ data: AdminUser }>(`/admin/users/${targetId}/${action}`, { ...payload, actionReceipt: confirmation.data.data.actionReceipt }, { timeout: 20000 })).data.data
  },
  backups: (signal?: AbortSignal, params?: object) => get<Backups>('backups', params, signal),
  enqueueBackup: async (reason: string) => (await api.post<{ data: BackupItem }>('/admin/backups', { reason, acknowledgeNonSnapshot: true }, { timeout: 20000 })).data.data,
}
