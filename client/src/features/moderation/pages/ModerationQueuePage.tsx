import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStoryQueue, useChapterQueue, useCommentQueue, useModerateStory, useModerateChapter, useModerateComment } from '../hooks/useModeration'
import ModerationActionModal from '../components/ModerationActionModal'
import type { ModerationActionInput } from '@/types/moderation'

type QueueTab = 'stories' | 'chapters' | 'comments'
type StoryAction = 'approve' | 'hide' | 'remove' | 'request_revision'
type ChapterAction = 'approve' | 'hide' | 'remove'
type CommentAction = 'approve' | 'hide' | 'delete'

interface PendingAction {
  id: string
  title: string
  targetType: 'story' | 'chapter' | 'comment'
  action: StoryAction | ChapterAction | CommentAction
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ duyệt', cls: 'badge-pending' },
  approved: { label: 'Đã duyệt', cls: 'badge-approved' },
  hidden: { label: 'Đã ẩn', cls: 'badge-hidden' },
  removed: { label: 'Đã gỡ', cls: 'badge-removed' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

// ─── Story Queue Tab ──────────────────────────────────────────────────────────

function StoryQueueTab({
  search,
  sort,
  onAction,
}: {
  search: string
  sort: 'oldest' | 'newest'
  onAction: (a: PendingAction) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useStoryQueue({ search, sort, limit: 20 })

  const stories = useMemo(
    () => data?.pages.flatMap((p) => p.stories) ?? [],
    [data]
  )

  if (isLoading) return <div className="mod-queue-loading" role="status">Đang tải...</div>
  if (isError) return <div className="mod-queue-error" role="alert">Không thể tải danh sách truyện.</div>
  if (!stories.length) return <div className="mod-queue-empty">✅ Không có truyện nào chờ duyệt.</div>

  return (
    <div className="mod-queue-list">
      {stories.map((story) => {
        const author = story.authorId as { displayName?: string; username?: string } | undefined
        const isExpanded = expanded === story._id
        const statusMeta = STATUS_BADGE[story.moderationStatus] ?? { label: story.moderationStatus, cls: '' }

        return (
          <div key={story._id} className={`mod-queue-item${isExpanded ? ' expanded' : ''}`} id={`story-item-${story._id}`}>
            <div className="mod-queue-item-header" onClick={() => setExpanded(isExpanded ? null : story._id)}>
              <div className="mod-queue-item-left">
                {story.coverUrl ? (
                  <img src={story.coverUrl} alt={story.title} className="mod-queue-cover" />
                ) : (
                  <div className="mod-queue-cover-placeholder story">📚</div>
                )}
                <div>
                  <div className="mod-queue-item-title">{story.title}</div>
                  <div className="mod-queue-item-meta">
                    <span>Tác giả: {author?.displayName ?? author?.username ?? 'Ẩn danh'}</span>
                    <span>·</span>
                    <span>{timeAgo(story.createdAt)}</span>
                    <span className={`mod-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                  </div>
                </div>
              </div>
              <div className="mod-queue-item-actions">
                <button
                  type="button"
                  className="btn-mod-revision"
                  aria-expanded={isExpanded}
                  aria-controls={`story-review-${story._id}`}
                  onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : story._id) }}
                >{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</button>
                <button
                  id={`story-approve-${story._id}`}
                  className="btn-mod-approve"
                  onClick={(e) => { e.stopPropagation(); onAction({ id: story._id, title: story.title, targetType: 'story', action: 'approve' }) }}
                >✓ Duyệt</button>
                <button
                  id={`story-revision-${story._id}`}
                  className="btn-mod-revision"
                  onClick={(e) => { e.stopPropagation(); onAction({ id: story._id, title: story.title, targetType: 'story', action: 'request_revision' }) }}
                >✎ Yêu cầu sửa</button>
                <button
                  id={`story-hide-${story._id}`}
                  className="btn-mod-hide"
                  onClick={(e) => { e.stopPropagation(); onAction({ id: story._id, title: story.title, targetType: 'story', action: 'hide' }) }}
                >⊘ Ẩn</button>
                <button
                  id={`story-remove-${story._id}`}
                  className="btn-mod-remove"
                  onClick={(e) => { e.stopPropagation(); onAction({ id: story._id, title: story.title, targetType: 'story', action: 'remove' }) }}
                >✕ Gỡ</button>
                <span className="mod-expand-toggle">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Quick Review Panel */}
            {isExpanded && (
              <div className="mod-quick-review" id={`story-review-${story._id}`}>
                {story.description && (
                  <div className="mod-review-section">
                    <div className="mod-review-label">Mô tả:</div>
                    <p className="mod-review-text">{story.description}</p>
                  </div>
                )}
                {story.genreIds && story.genreIds.length > 0 && (
                  <div className="mod-review-section">
                    <div className="mod-review-label">Thể loại:</div>
                    <div className="mod-review-tags">
                      {(story.genreIds as Array<{ _id: string; name: string }>).map((g) => <span key={g._id} className="mod-tag">{g.name}</span>)}
                    </div>
                  </div>
                )}
                {story.tagIds && story.tagIds.length > 0 && (
                  <div className="mod-review-section">
                    <div className="mod-review-label">Tags:</div>
                    <div className="mod-review-tags">
                      {(story.tagIds as Array<{ _id: string; name: string }>).map((t) => <span key={t._id} className="mod-tag mod-tag-secondary">{t.name}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {hasNextPage && (
        <button
          id="story-queue-load-more"
          className="btn-mod-load-more"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}
    </div>
  )
}

// ─── Chapter Queue Tab ────────────────────────────────────────────────────────

function ChapterQueueTab({
  search,
  sort,
  onAction,
}: {
  search: string
  sort: 'oldest' | 'newest'
  onAction: (a: PendingAction) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useChapterQueue({ search, sort, limit: 20 })

  const chapters = useMemo(
    () => data?.pages.flatMap((p) => p.chapters) ?? [],
    [data]
  )

  if (isLoading) return <div className="mod-queue-loading" role="status">Đang tải...</div>
  if (isError) return <div className="mod-queue-error" role="alert">Không thể tải danh sách chương.</div>
  if (!chapters.length) return <div className="mod-queue-empty">✅ Không có chương nào chờ duyệt.</div>

  return (
    <div className="mod-queue-list">
      {chapters.map((chapter) => {
        const story = chapter.storyId as { title?: string; slug?: string } | undefined
        const isExpanded = expanded === chapter._id
        return (
          <div key={chapter._id} className="mod-queue-item" id={`chapter-item-${chapter._id}`}>
            <div className="mod-queue-item-header">
              <div className="mod-queue-item-left">
                <div className="mod-queue-cover-placeholder">📄</div>
                <div>
                  <div className="mod-queue-item-title">{chapter.title}</div>
                  <div className="mod-queue-item-meta">
                    <span>Truyện: {story?.title ?? '—'}</span>
                    {story?.slug && <span className="break-all">/{story.slug}</span>}
                    <span>·</span>
                    <span>Chương {chapter.order}</span>
                    <span>·</span>
                    <span>{timeAgo(chapter.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mod-queue-item-actions">
                <button type="button" className="btn-mod-revision" aria-expanded={isExpanded} aria-controls={`chapter-review-${chapter._id}`} onClick={() => setExpanded(isExpanded ? null : chapter._id)}>{isExpanded ? 'Thu gọn' : 'Xem nội dung'}</button>
                <button id={`chapter-approve-${chapter._id}`} className="btn-mod-approve" onClick={() => onAction({ id: chapter._id, title: chapter.title, targetType: 'chapter', action: 'approve' })}>✓ Duyệt</button>
                <button id={`chapter-hide-${chapter._id}`} className="btn-mod-hide" onClick={() => onAction({ id: chapter._id, title: chapter.title, targetType: 'chapter', action: 'hide' })}>⊘ Ẩn</button>
                <button id={`chapter-remove-${chapter._id}`} className="btn-mod-remove" onClick={() => onAction({ id: chapter._id, title: chapter.title, targetType: 'chapter', action: 'remove' })}>✕ Gỡ</button>
              </div>
            </div>
            {isExpanded && (
              <div className="mod-quick-review" id={`chapter-review-${chapter._id}`}>
                <div className="mod-review-label">Nội dung chương đầy đủ</div>
                {chapter.contentHtml ? (
                  <iframe
                    title={`Nội dung ${chapter.title}`}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    className="mod-chapter-preview"
                    srcDoc={`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0;padding:24px;font:18px/1.9 Georgia,serif;color:#1e293b;background:#fff;overflow-wrap:anywhere}p{margin:0 0 1em}blockquote{border-left:3px solid #cbd5e1;margin-left:0;padding-left:16px}</style></head><body>${chapter.contentHtml}</body></html>`}
                  />
                ) : <p className="mod-review-text">Chương chưa có nội dung.</p>}
              </div>
            )}
          </div>
        )
      })}

      {hasNextPage && (
        <button id="chapter-queue-load-more" className="btn-mod-load-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}
    </div>
  )
}

// ─── Comment Queue Tab ────────────────────────────────────────────────────────

function CommentQueueTab({
  search,
  sort,
  onAction,
}: {
  search: string
  sort: 'oldest' | 'newest'
  onAction: (a: PendingAction) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useCommentQueue({ search, sort, limit: 20 })

  const comments = useMemo(
    () => data?.pages.flatMap((p) => p.comments) ?? [],
    [data]
  )

  if (isLoading) return <div className="mod-queue-loading" role="status">Đang tải...</div>
  if (isError) return <div className="mod-queue-error" role="alert">Không thể tải danh sách bình luận.</div>
  if (!comments.length) return <div className="mod-queue-empty">✅ Không có bình luận nào cần kiểm duyệt.</div>

  return (
    <div className="mod-queue-list">
      {comments.map((comment) => {
        const user = comment.userId
        const isExpanded = expanded === comment._id
        const spamLevel = (comment.spamScore ?? 0) > 70 ? 'high' : (comment.spamScore ?? 0) > 30 ? 'medium' : 'low'
        return (
          <div key={comment._id} className="mod-queue-item" id={`comment-item-${comment._id}`}>
            <div className="mod-queue-item-header">
              <div className="mod-queue-item-left">
                <div className="mod-queue-cover-placeholder">💬</div>
                <div style={{ flex: 1 }}>
                  <div className="mod-queue-item-title">
                    {user?.displayName ?? user?.username ?? 'Ẩn danh'}
                    {(comment.spamScore ?? 0) > 0 && (
                      <span className={`mod-spam-badge ${spamLevel}`}>Spam {comment.spamScore}%</span>
                    )}
                    {comment.isLocked && <span className="mod-spam-badge high">Đã khóa</span>}
                  </div>
                  <div className="mod-comment-content">"{comment.content?.slice(0, 120)}{comment.content?.length > 120 ? '…' : ''}"</div>
                  <div className="mod-queue-item-meta">
                    <span>Truyện: {(comment.storyId as any)?.title ?? '—'}</span>
                    <span>·</span>
                    <span>{timeAgo(comment.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mod-queue-item-actions">
                <button type="button" className="btn-mod-revision" aria-expanded={isExpanded} aria-controls={`comment-review-${comment._id}`} onClick={() => setExpanded(isExpanded ? null : comment._id)}>{isExpanded ? 'Thu gọn' : 'Xem nội dung'}</button>
                <button id={`comment-approve-${comment._id}`} className="btn-mod-approve" onClick={() => onAction({ id: comment._id, title: comment.content?.slice(0, 50), targetType: 'comment', action: 'approve' })}>✓ Bỏ cờ</button>
                <button id={`comment-hide-${comment._id}`} className="btn-mod-hide" onClick={() => onAction({ id: comment._id, title: comment.content?.slice(0, 50), targetType: 'comment', action: 'hide' })}>⊘ Ẩn</button>
                <button id={`comment-delete-${comment._id}`} className="btn-mod-remove" onClick={() => onAction({ id: comment._id, title: comment.content?.slice(0, 50), targetType: 'comment', action: 'delete' })}>✕ Xóa</button>
              </div>
            </div>
            {isExpanded && (
              <div className="mod-quick-review" id={`comment-review-${comment._id}`}>
                <div className="mod-review-label">Bình luận đầy đủ</div>
                <p className="mod-review-text whitespace-pre-wrap break-words">{comment.content}</p>
              </div>
            )}
          </div>
        )
      })}

      {hasNextPage && (
        <button id="comment-queue-load-more" className="btn-mod-load-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}
    </div>
  )
}

interface ModerationQueuePageProps {
  defaultType?: QueueTab
}

export default function ModerationQueuePage({ defaultType }: ModerationQueuePageProps = {}) {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const activeTab: QueueTab = (type as QueueTab) || defaultType || 'stories'

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'oldest' | 'newest'>('oldest')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const moderateStoryMut = useModerateStory()
  const moderateChapterMut = useModerateChapter()
  const moderateCommentMut = useModerateComment()

  const isPending = moderateStoryMut.isPending || moderateChapterMut.isPending || moderateCommentMut.isPending

  const tabs: { key: QueueTab; label: string; icon: string }[] = [
    { key: 'stories', label: 'Truyện', icon: '📚' },
    { key: 'chapters', label: 'Chương', icon: '📄' },
    { key: 'comments', label: 'Bình luận', icon: '💬' },
  ]

  const handleConfirm = (data: ModerationActionInput) => {
    if (!pendingAction) return

    const { id, targetType, action } = pendingAction
    if (targetType === 'story') {
      moderateStoryMut.mutate(
        { id, action: action as StoryAction, body: data },
        { onSettled: () => setPendingAction(null) }
      )
    } else if (targetType === 'chapter') {
      moderateChapterMut.mutate(
        { id, action: action as ChapterAction, body: data },
        { onSettled: () => setPendingAction(null) }
      )
    } else {
      moderateCommentMut.mutate(
        { id, action: action as CommentAction, body: data },
        { onSettled: () => setPendingAction(null) }
      )
    }
  }

  return (
    <div className="mod-page">
      {/* Page Header */}
      <div className="mod-page-header">
        <h1 className="mod-page-title">Hàng Đợi Kiểm Duyệt</h1>
        <p className="mod-page-subtitle">Duyệt và xử lý nội dung vi phạm từ người dùng</p>
      </div>

      {/* Tabs */}
      <div className="mod-tabs" role="tablist" aria-label="Loại nội dung" onKeyDown={event => {
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const current = controls.indexOf(event.target as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : event.key === 'ArrowRight' ? (current + 1) % controls.length : event.key === 'ArrowLeft' ? (current + controls.length - 1) % controls.length : -1
        if (next >= 0) { event.preventDefault(); controls[next]?.focus(); controls[next]?.click() }
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`mod-tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls="moderation-queue-panel"
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={`mod-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => navigate(`/mod/${tab.key}`)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mod-filters">
        <input
          id="mod-search-input"
          aria-label="Tìm kiếm nội dung kiểm duyệt"
          className="mod-search-input"
          type="search"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          id="mod-sort-select"
          aria-label="Sắp xếp hàng đợi"
          className="mod-sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'oldest' | 'newest')}
        >
          <option value="oldest">Cũ nhất trước (FIFO)</option>
          <option value="newest">Mới nhất trước</option>
        </select>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id="moderation-queue-panel" aria-labelledby={`mod-tab-${activeTab}`} className="mod-queue-panel">
        {activeTab === 'stories' && (
          <StoryQueueTab search={search} sort={sort} onAction={setPendingAction} />
        )}
        {activeTab === 'chapters' && (
          <ChapterQueueTab search={search} sort={sort} onAction={setPendingAction} />
        )}
        {activeTab === 'comments' && (
          <CommentQueueTab search={search} sort={sort} onAction={setPendingAction} />
        )}
      </div>

      {/* Action Modal */}
      {pendingAction && (
        <ModerationActionModal
          isOpen={!!pendingAction}
          targetType={pendingAction.targetType}
          targetTitle={pendingAction.title}
          action={pendingAction.action as any}
          onConfirm={handleConfirm}
          onClose={() => setPendingAction(null)}
          isPending={isPending}
        />
      )}
    </div>
  )
}
