import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { Feather, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useBecomeAuthor } from '@/features/auth/hooks/useUser'
import type { User } from '@/types/user'

interface AuthorApplicationFormProps {
  user: User
}

export default function AuthorApplicationForm({ user }: AuthorApplicationFormProps) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? '')
  const [hasAccepted, setHasAccepted] = useState(false)
  const [validationError, setValidationError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const application = useBecomeAuthor()
  const errorMessage = application.error
    ? (isAxiosError(application.error) && typeof application.error.response?.data?.message === 'string'
      ? application.error.response.data.message
      : 'Chưa gửi được đơn đăng ký. Vui lòng thử lại.')
    : ''

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (application.isPending) return
    if (!displayName.trim() || displayName.trim().length > 50) {
      setValidationError('Vui lòng nhập bút danh từ 1 đến 50 ký tự.')
      nameRef.current?.focus()
      return
    }
    if (bio.trim().length > 500 || !hasAccepted) return
    setValidationError('')
    application.mutate({ displayName: displayName.trim(), bio: bio.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Đơn đăng ký làm tác giả">
      <fieldset disabled={application.isPending} className="min-w-0 space-y-5 disabled:opacity-70">
        <legend className="sr-only">Thông tin tác giả</legend>
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-sm font-semibold text-foreground">Tài khoản đăng ký</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-3">
            <Label htmlFor="author-email">Email tài khoản</Label>
            <Input id="author-email" type="email" value={user.email} readOnly aria-describedby="author-email-help" />
            <p id="author-email-help" className="mt-2 text-xs text-muted-foreground">Email đang liên kết với tài khoản của bạn.</p>
          </div>
        </div>

        <div>
          <Label htmlFor="author-display-name" required>Bút danh / tên hiển thị</Label>
          <Input
            ref={nameRef}
            id="author-display-name"
            value={displayName}
            onChange={event => { setDisplayName(event.target.value); setValidationError('') }}
            placeholder="Tên bạn muốn độc giả biết đến"
            autoComplete="nickname"
            maxLength={50}
            required
            error={validationError}
            aria-describedby="author-name-help"
          />
          <p id="author-name-help" className="mt-2 text-xs text-muted-foreground">Tên hiển thị công khai trên hồ sơ và tác phẩm của bạn. Tối đa 50 ký tự.</p>
        </div>

        <div>
          <Label htmlFor="author-bio">Giới thiệu bản thân</Label>
          <textarea
            id="author-bio"
            value={bio}
            onChange={event => setBio(event.target.value)}
            placeholder="Chia sẻ đôi nét về bạn và những câu chuyện bạn muốn viết…"
            rows={5}
            maxLength={500}
            aria-describedby="author-bio-help author-bio-count"
            className="block w-full min-w-0 resize-y rounded-xl border border-border bg-surface-elevated px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <p id="author-bio-help">Không bắt buộc. Hiển thị trên hồ sơ công khai.</p>
            <span id="author-bio-count">{bio.length}/500 ký tự</span>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-link" />
          <p>Khi gửi đơn, bút danh và giới thiệu sẽ được lưu vào hồ sơ của bạn. Quản trị viên sẽ xét duyệt yêu cầu trước khi bạn có thể đăng truyện.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground">
          <input
            type="checkbox"
            checked={hasAccepted}
            onChange={event => setHasAccepted(event.target.checked)}
            required
            className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span>Tôi cam kết có quyền đăng tải nội dung, ghi rõ tác giả và nguồn khi cần, đồng thời tuân thủ quy định kiểm duyệt của iutruyen.</span>
        </label>
      </fieldset>

      {errorMessage && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorMessage}</p>}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost"><Link to={ROUTES.PROFILE}>Quay lại hồ sơ</Link></Button>
        <Button type="submit" size="lg" className="whitespace-normal" isLoading={application.isPending}>
          <Feather aria-hidden="true" className="h-4 w-4 shrink-0" />
          {application.isPending ? 'Đang gửi đơn…' : 'Gửi đơn đăng ký'}
        </Button>
      </div>
    </form>
  )
}
