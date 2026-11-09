import React, { useState } from 'react'
import { Send, LogIn, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Link } from 'react-router-dom'

interface CommentBoxProps {
  onSubmit: (content: string) => Promise<void>
  placeholder?: string
  isLoading?: boolean
  chapterTitle?: string
}

export const CommentBox: React.FC<CommentBoxProps> = ({
  onSubmit,
  placeholder = 'Chia sẻ cảm nghĩ của bạn về tác phẩm...',
  isLoading = false,
  chapterTitle,
}) => {
  const { user, isAuthenticated } = useAuthStore()
  const [content, setContent] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const contentId = React.useId()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || isLoading) return
    setErrorMsg(null)

    try {
      await onSubmit(content.trim())
      setContent('')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể đăng bình luận.')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-border/80 bg-surface-raised/40 p-4 text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Vui lòng đăng nhập để tham gia bình luận thảo luận.
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-full font-semibold">
          <Link to="/login">
            <LogIn className="h-3.5 w-3.5 mr-1.5 text-link" />
            Đăng nhập ngay
          </Link>
        </Button>
      </div>
    )
  }

  const charCount = content.length
  const maxChars = 1000

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {chapterTitle && (
        <div className="text-[11px] font-semibold text-link px-1">
          Bình luận tại: {chapterTitle}
        </div>
      )}

      <div className="relative rounded-2xl border border-border bg-card p-3 shadow-2xs focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <div className="flex items-start gap-3">
          {/* User Avatar */}
          <div className="h-8 w-8 rounded-full bg-secondary text-link flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden border border-border">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.displayName || user?.username || 'U').charAt(0).toUpperCase()
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 min-w-0">
            <textarea
              id={contentId}
              aria-label="Nội dung bình luận"
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? `${contentId}-error` : undefined}
              rows={2}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              placeholder={placeholder}
              maxLength={maxChars}
              disabled={isLoading}
              className="w-full resize-none border-0 bg-transparent p-0 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed"
            />
          </div>
        </div>

        {/* Footer info & Action button */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2">
          <span className={`text-[10px] ${charCount > maxChars - 50 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
            {charCount}/{maxChars}
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isLoading}
            isLoading={isLoading}
            className="rounded-full px-4 h-7 text-xs font-bold shadow-xs"
          >
            <Send className="h-3 w-3 mr-1" />
            Gửi bình luận
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div id={`${contentId}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-destructive px-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </form>
  )
}
