import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthStore } from '@/features/auth/store/authStore'
import CrawlerJobForm from '@/features/chapters/components/CrawlerJobForm'
import CrawlerJobList from '@/features/chapters/components/CrawlerJobList'
import CrawlerJobDetail from '@/features/chapters/components/CrawlerJobDetail'

function CrawlerJobsWorkspace({ actorId }: { actorId: string }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const selectedId = params.get('jobId') ?? ''
  const initialStoryId = params.get('storyId') ?? undefined
  const initialUrl = typeof location.state?.sourceUrl === 'string' ? location.state.sourceUrl.slice(0, 2048) : undefined
  const handleSelect = (jobId: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('jobId', jobId); return next })
  return <div className="space-y-6">
    <CrawlerJobForm actorId={actorId} initialStoryId={initialStoryId} initialUrl={initialUrl} onPrepared={job => handleSelect(job.id)} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <CrawlerJobList actorId={actorId} selectedId={selectedId} onSelect={handleSelect} />
      {selectedId ? <CrawlerJobDetail key={selectedId} actorId={actorId} jobId={selectedId} />
        : <p className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">Chọn một đợt nhập để xem kế hoạch và tiến độ.</p>}
    </div>
  </div>
}

export default function CrawlerJobsPage() {
  const user = useAuthStore(state => state.user)
  const isApproved = user?.role === 'admin' || (user?.role === 'author' && user.authorStatus === 'approved')
  return <AppLayout>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-foreground sm:px-6">
      <Link to="/author/stories" className="text-link hover:underline">← Quản lý truyện</Link>
      <div><h1 className="font-serif text-3xl font-bold">Nhập nhiều truyện và chương</h1>
        <p className="mt-2 text-muted-foreground">Chuẩn bị nguồn, xem kế hoạch rồi nhập các chương vào bản nháp. Tiến độ được giữ để bạn tiếp tục theo dõi khi mở lại trang.</p></div>
      {!isApproved || !user?.id ? <p role="alert" className="rounded-xl border border-border bg-card p-5">Tài khoản tác giả cần được duyệt để nhập truyện và chương.</p>
        : <CrawlerJobsWorkspace key={user.id} actorId={user.id} />}
    </div>
  </AppLayout>
}
