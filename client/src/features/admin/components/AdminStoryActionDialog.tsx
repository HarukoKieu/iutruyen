import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { CheckCircle2, EyeOff, Trash2, X, AlertCircle } from 'lucide-react'
import { moderateStory } from '@/features/moderation/api/moderation.api'
import { Button } from '@/components/ui/button'
import { adminError } from '../hooks/useAdmin'
import type { AdminStory } from '../types'
import { useAdminDialog } from '../hooks/useAdminDialog'

export default function AdminStoryActionDialog({
  story,
  action,
  onClose,
}: {
  story: AdminStory
  action: 'approve' | 'hide' | 'remove'
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const client = useQueryClient()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    retry: false,
    mutationFn: () => moderateStory(story.id, action, { reason, notifyUser: true }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin'] }),
        client.invalidateQueries({ queryKey: ['moderation'] }),
        client.invalidateQueries({ queryKey: ['stories'] }),
      ])
      onClose()
    },
  })

  useAdminDialog(dialog)

  const isApprove = action === 'approve'
  const isHide = action === 'hide'

  const ActionIcon = isApprove ? CheckCircle2 : isHide ? EyeOff : Trash2

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="story-action-title"
      aria-describedby="story-action-description"
      onCancel={event => {
        if (mutation.isPending) event.preventDefault()
        else onClose()
      }}
      className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto break-words rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              isApprove
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isHide
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            <ActionIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 id="story-action-title" className="text-lg font-bold leading-tight">
              {action === 'approve' ? 'Duyệt' : action === 'hide' ? 'Ẩn' : 'Gỡ'} truyện: {story.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID truyện: {story.id} • Slug: /{story.slug}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-lg p-1 text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          aria-label="Đóng cửa sổ"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        id="story-action-description"
        className="my-4 rounded-xl border border-border bg-surface-raised/40 p-3.5 text-xs sm:text-sm text-muted-foreground leading-relaxed flex items-start gap-2.5"
      >
        <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
        <span>
          Áp dụng luồng kiểm duyệt và audit hiện hữu. Thao tác thay đổi khả năng truy cập công khai của truyện và chương.
        </span>
      </div>

      <form
        onSubmit={event => {
          event.preventDefault()
          mutation.mutate()
        }}
        className="space-y-4"
      >
        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          <span className="flex justify-between">
            <span>Lý do</span>
            <span className="text-xs text-muted-foreground font-mono">{reason.length}/500</span>
          </span>
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="Nêu rõ lý do quyết định kiểm duyệt nội dung…"
            value={reason}
            onChange={event => setReason(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {mutation.isError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
            {adminError(mutation.error)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
            className="rounded-lg"
          >
            Hủy
          </Button>
          <Button
            variant={action === 'approve' ? 'default' : 'destructive'}
            disabled={mutation.isPending || reason.trim().length < 10}
            className="rounded-lg font-semibold"
          >
            {mutation.isPending ? 'Đang thực hiện…' : 'Xác nhận'}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body
  )
}

