import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useMyReview, useReviews, useReviewMutations } from '../hooks/useRatingsReviews'
import { ReviewCard } from './ReviewCard'
import { ReviewFormModal } from './ReviewFormModal'

export function ReviewSection({ storyId, storyTitle }: { storyId: string; storyTitle: string }) {
  const { user, isAuthenticated } = useAuthStore()
  const [sort, setSort] = useState<'newest' | 'top'>('newest')
  const [editing, setEditing] = useState(false)
  const reviews = useReviews(storyId, { sort })
  const mine = useMyReview(storyId, isAuthenticated)
  const mutations = useReviewMutations(storyId)
  const runAction = async (action: () => Promise<unknown>) => {
    try { await action() } catch { toast.error('Không thể cập nhật bài cảm nhận. Vui lòng thử lại.') }
  }
  return (
    <section aria-label="Cảm nhận về truyện" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Cảm nhận về truyện</h2>
        <select aria-label="Sắp xếp cảm nhận" value={sort} onChange={e => setSort(e.target.value === 'top' ? 'top' : 'newest')} className="rounded-lg border border-border bg-background p-2 text-sm">
          <option value="newest">Mới nhất</option>
          <option value="top">Hữu ích nhất</option>
        </select>
        {isAuthenticated
          ? <Button onClick={() => setEditing(true)} disabled={mine.isLoading || mine.isError}>{mine.data?.review ? 'Sửa cảm nhận của bạn' : 'Viết cảm nhận'}</Button>
          : <Link to="/login" className="text-link">Đăng nhập để viết cảm nhận</Link>}
      </div>
      {mine.isError && <p role="alert">Không thể tải cảm nhận của bạn. <button onClick={() => { void mine.refetch() }} className="text-link">Thử lại</button></p>}
      {reviews.isLoading && <p role="status">Đang tải cảm nhận…</p>}
      {reviews.isError && <p role="alert">Không thể tải cảm nhận. <button onClick={() => { void reviews.refetch() }} className="text-link">Thử lại</button></p>}
      {reviews.data?.pages.flatMap(page => page.items).map(review =>
        <ReviewCard key={review._id} review={review}
          onLike={id => runAction(() => mutations.toggleLikeReview(id))}
          onDelete={id => runAction(() => mutations.deleteReview(id))}
          onEdit={user?.id === review.userId?._id ? () => setEditing(true) : undefined} />
      )}
      {!reviews.isLoading && !reviews.isError && reviews.data?.pages.every(page => !page.items.length) && <p className="text-muted-foreground">Chưa có cảm nhận về truyện này.</p>}
      {reviews.hasNextPage && <Button variant="outline" disabled={reviews.isFetchingNextPage} onClick={() => { void reviews.fetchNextPage() }}>Tải thêm cảm nhận</Button>}
      <ReviewFormModal isOpen={editing} onClose={() => setEditing(false)} storyTitle={storyTitle}
        initialContent={mine.data?.review?.content ?? ''} isLoading={mutations.isUpserting}
        onSubmit={async content => { await mutations.upsertReview(content) }} />
    </section>
  )
}
