import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Feather, ShieldCheck } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useCurrentUser } from '@/features/auth/hooks/useAuth'
import AuthorApplicationForm from '../components/AuthorApplicationForm'

export default function AuthorApplicationPage() {
  const { user, hasHydrated } = useAuthStore()
  const location = useLocation()
  const currentUser = useCurrentUser()

  if (!hasHydrated) return <p role="status" className="p-6">Đang khôi phục phiên đăng nhập…</p>

  const canPublish = user?.role === 'admin' || (user?.role === 'author' && user.authorStatus === 'approved')
  const isPending = user?.authorStatus === 'pending'
  const canApply = user?.role === 'user' && !isPending

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link to={ROUTES.PROFILE} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-link">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />Hồ sơ cá nhân
        </Link>
        <header className="mb-8 mt-4 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-link">
            <Feather aria-hidden="true" className="h-3.5 w-3.5" />Không gian sáng tác
          </span>
          <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Đăng ký làm tác giả</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">Mỗi câu chuyện đều bắt đầu từ một người viết. Chia sẻ tác phẩm của bạn và kết nối với độc giả trên iutruyen.</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-8">
          <aside className="order-2 min-w-0 space-y-5 lg:order-none" aria-label="Hướng dẫn đăng ký tác giả">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
              <BookOpen aria-hidden="true" className="h-8 w-8 text-link" />
              <h2 className="mt-4 text-lg font-bold text-foreground">Viết câu chuyện của riêng bạn</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Sau khi được duyệt, bạn có thể tạo truyện, lưu bản nháp, quản lý chương và chia sẻ tác phẩm với cộng đồng.</p>
              <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">Đăng ký miễn phí. Nội dung công khai được đọc miễn phí.</div>
            </Card>
            <Card className="p-6">
              <h2 className="text-sm font-bold text-foreground">Hành trình trở thành tác giả</h2>
              <ol className="mt-5 space-y-5">
                {[
                  { title: 'Hoàn thiện hồ sơ', description: 'Chọn bút danh và giới thiệu đôi nét về bạn.' },
                  { title: 'Gửi đơn xét duyệt', description: 'Quản trị viên xem xét yêu cầu đăng ký của bạn.' },
                  { title: 'Bắt đầu sáng tác', description: 'Vào khu vực tác giả sau khi được phê duyệt.' },
                ].map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-link">{index + 1}</span>
                    <div><p className="text-sm font-semibold text-foreground">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p></div>
                  </li>
                ))}
              </ol>
            </Card>
          </aside>

          <Card className="order-1 min-w-0 p-5 sm:p-8 lg:order-none">
            {!user ? (
              <div className="py-6 text-center">
                <Feather aria-hidden="true" className="mx-auto h-10 w-10 text-link" />
                <h2 className="mt-4 text-xl font-bold">Đăng nhập để đăng ký tác giả</h2>
                <p className="mt-3 text-sm text-muted-foreground">Sử dụng tài khoản iutruyen của bạn để gửi đơn và theo dõi trạng thái xét duyệt.</p>
                <Button asChild className="mt-6"><Link to={ROUTES.LOGIN} state={{ from: location }}>Đăng nhập</Link></Button>
              </div>
            ) : canPublish ? (
              <div className="py-6 text-center">
                <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-success" />
                <h2 className="mt-4 text-xl font-bold">Bạn đã có quyền đăng truyện</h2>
                <p className="mt-3 text-sm text-muted-foreground">Không gian sáng tác đã sẵn sàng. Bắt đầu viết và quản lý tác phẩm của bạn.</p>
                <Button asChild className="mt-6"><Link to={ROUTES.AUTHOR_STORIES}>Vào khu vực tác giả</Link></Button>
              </div>
            ) : isPending ? (
              <div role="status" className="py-6 text-center">
                <Clock aria-hidden="true" className="mx-auto h-10 w-10 text-warning" />
                <h2 className="mt-4 text-xl font-bold">Đơn đăng ký đang chờ duyệt</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Yêu cầu của bạn đã được gửi thành công. Quản trị viên sẽ xem xét và cấp quyền tác giả khi đơn được chấp thuận.</p>
                <p className="mt-3 text-sm text-muted-foreground">Bạn có thể tiếp tục đọc truyện trong lúc chờ xét duyệt.</p>
                {currentUser.isError && <p role="alert" className="mt-4 text-sm text-destructive">Chưa cập nhật được trạng thái đơn. Vui lòng thử lại.</p>}
                <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => { void currentUser.refetch() }} isLoading={currentUser.isFetching}>Cập nhật trạng thái</Button>
                <Button asChild variant="outline" className="mt-6"><Link to={ROUTES.PROFILE}>Về hồ sơ cá nhân</Link></Button>
              </div>
            ) : canApply ? (
              <>
                <div className="mb-6"><h2 className="text-xl font-bold text-foreground">Thông tin đăng ký</h2><p className="mt-2 text-sm text-muted-foreground">Kiểm tra thông tin và xác nhận cam kết trước khi gửi đơn.</p></div>
                {user.authorStatus === 'revoked' && <p className="mb-5 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">Quyền tác giả của bạn đã được thu hồi. Bạn có thể cập nhật hồ sơ và gửi lại yêu cầu để quản trị viên xem xét.</p>}
                <AuthorApplicationForm key={user.id} user={user} />
              </>
            ) : (
              <div className="py-6 text-center">
                <ShieldCheck aria-hidden="true" className="mx-auto h-10 w-10 text-link" />
                <h2 className="mt-4 text-xl font-bold">Tài khoản chưa thể gửi đơn</h2>
                <p className="mt-3 text-sm text-muted-foreground">Vui lòng liên hệ quản trị viên để được hỗ trợ về quyền tác giả cho tài khoản hiện tại.</p>
                <Button asChild variant="outline" className="mt-6"><Link to={ROUTES.PROFILE}>Về hồ sơ cá nhân</Link></Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
