import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { api } from '@/lib/axios'

export default function SiteAnnouncement() {
  const hasHydrated = useAuthStore(state => state.hasHydrated)
  const query = useQuery({ queryKey: ['site-config'], enabled: hasHydrated,
    queryFn: async ({ signal }) => (await api.get<{ data: { siteName: string; description: string; announcement: string; version: number } }>('/site-config', { signal })).data.data,
    staleTime: 60000, retry: false })
  if (!query.data?.announcement) return null
  return <aside aria-label={`Thông báo ${query.data.siteName}`} className="mx-4 my-3 max-w-7xl rounded-lg border bg-card p-4 text-foreground break-words sm:mx-6 xl:mx-auto"><strong>{query.data.siteName}</strong>{query.data.description && <p className="text-sm text-muted-foreground">{query.data.description}</p>}<p className="whitespace-pre-wrap">{query.data.announcement}</p></aside>
}
