import { useAuthStore } from '@/features/auth/store/authStore'
import type { ReactNode } from 'react'
import { useLoaderData, useParams } from 'react-router-dom'
import { useSeoHead } from '@/hooks/useSeoHead'
import type { PublicPage } from './publicPage'
import { fallbackMeta } from './publicPage'
import { RenderClock } from './renderClock'
import { usePublicQueryPolicy } from './usePublicQueryPolicy'
import { useMatureConfirmation } from '@/features/stories/hooks/useMatureConfirmation'

/** Shared server/browser boundary: mature body is never in the initial payload. */
export function PublicRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore(state => state.user)
  const page = useLoaderData() as PublicPage
  const { chapterSlug } = useParams<{ chapterSlug: string }>()
  const unavailable = usePublicQueryPolicy(page.story?.slug ?? '', chapterSlug, user?.id || 'public')
  const { isConfirmed, confirm } = useMatureConfirmation(page.story?._id ?? '')
  const meta = unavailable ? fallbackMeta() : page.meta
  useSeoHead({ ...meta, ogImage: meta.og.image, ogType: meta.og.type })
  if (page.status === 404 && user && ['author', 'moderator', 'admin'].includes(user.role)) return children
  if (page.status !== 200) return <main className="mx-auto max-w-3xl p-8"><h1>{page.status === 404 ? 'Không tìm thấy nội dung' : 'Tạm thời không thể tải nội dung'}</h1><p>Vui lòng quay lại sau.</p><a href="/">Trang chủ</a></main>
  if (page.story?.contentWarning === 'mature18+' && !isConfirmed) return <main className="mx-auto max-w-3xl p-8"><h1>Nội dung dành cho độc giả 18+</h1><p>Bạn cần xác nhận trước khi tiếp tục đọc.</p><button type="button" className="rounded bg-primary px-4 py-2" onClick={confirm}>Tôi đủ 18 tuổi, tiếp tục</button><a className="ml-4" href="/">Quay lại</a></main>
  return <RenderClock.Provider value={page.now ?? 0}>{children}</RenderClock.Provider>
}
