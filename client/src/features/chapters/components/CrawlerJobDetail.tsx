import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CrawlerJobAction } from '@/types/crawler-job'
import { useControlCrawlerJob, useCrawlerJob } from '../hooks/useCrawlerJobs'
import { crawlErrorMessage } from '../api/crawler.api'
import { crawlerIssueMessage, crawlerJobLabels, isCrawlerJobTerminal } from '../utils/crawlerJobPresentation'
import CrawlerJobSources from './CrawlerJobSources'
import CrawlerJobTasks from './CrawlerJobTasks'
import CrawlerJobProgress from './CrawlerJobProgress'

interface CrawlerJobDetailProps { actorId: string; jobId: string }
const actionLabels: Record<CrawlerJobAction, string> = { start: 'bắt đầu nhập', pause: 'tạm dừng', resume: 'tiếp tục', cancel: 'hủy đợt nhập', retry: 'thử lại phần lỗi' }

export default function CrawlerJobDetail({ actorId, jobId }: CrawlerJobDetailProps) {
  const detail = useCrawlerJob(actorId, jobId)
  const control = useControlCrawlerJob(actorId, jobId)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isCancelConfirm, setIsCancelConfirm] = useState(false)
  const job = detail.data
  const handleAction = (action: CrawlerJobAction) => {
    if (control.isPending || (action === 'start' && !isConfirmed)) return
    control.mutate({ action, ...(action === 'start' ? { rightsConfirmed: true as const } : {}) }, {
      onSuccess: () => { setIsConfirmed(false); setIsCancelConfirm(false) },
    })
  }
  if (!job) return <section className="rounded-2xl border border-border bg-card p-6">
    {detail.isLoading ? <p role="status">Đang tải đợt nhập…</p> : <div role="alert" className="space-y-3 text-destructive">
      <p>{crawlErrorMessage(detail.error)}</p><Button variant="outline" isLoading={detail.isFetching} onClick={() => void detail.refetch()}>Thử tải chi tiết lại</Button>
    </div>}
  </section>
  const discovered = job.sources.filter(source => source.discovery.complete || source.errorCode || source.skipReason).length
  const processed = job.counters.succeeded + job.counters.skipped + job.counters.failed
  const canPause = ['planning', 'queued', 'running'].includes(job.status)
  const isTerminal = isCrawlerJobTerminal(job.status)
  return <section className="min-w-0 space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="job-title">
    <div className="space-y-2"><h2 id="job-title" className="font-serif text-xl font-bold">Chi tiết đợt nhập</h2>
      <p role="status" className="font-semibold text-link">{crawlerJobLabels[job.status]}</p>
      <p className="text-sm text-muted-foreground">Cập nhật {new Date(job.updatedAt).toLocaleString('vi-VN')}. Bạn có thể đóng trang rồi mở lại đợt nhập này.</p></div>
    {detail.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Chưa cập nhật được tiến độ: {crawlErrorMessage(detail.error)}</p>
      <Button variant="outline" isLoading={detail.isFetching} onClick={() => void detail.refetch()}>Tải lại tiến độ</Button></div>}
    {job.phase === 'planning' ? <div className="space-y-2">
      <p>Đã kiểm tra {discovered}/{job.sources.length} nguồn truyện.</p>
      <CrawlerJobProgress label="Tiến độ lấy mục lục" value={discovered} max={job.sources.length} />
      <p className="text-sm text-muted-foreground">Kế hoạch đã tìm thấy {job.counters.total} chương. Chưa lưu truyện hoặc nội dung chương.</p>
    </div> : <div className="space-y-3">
      <CrawlerJobProgress label="Tiến độ nhập chương" value={processed} max={job.counters.total} />
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Đã nhập</dt><dd className="font-semibold">{job.counters.succeeded}</dd></div>
        <div><dt className="text-muted-foreground">Bỏ qua</dt><dd className="font-semibold">{job.counters.skipped}</dd></div>
        <div><dt className="text-muted-foreground">Chương lỗi</dt><dd className="font-semibold text-destructive">{job.counters.failed}</dd></div>
        <div><dt className="text-muted-foreground">Chờ nhập</dt><dd className="font-semibold">{job.counters.pending}</dd></div>
      </dl>
    </div>}
    {job.errorCode && <p role="alert" className="text-sm text-destructive">{crawlerIssueMessage(job.errorCode)}</p>}
    <CrawlerJobSources sources={job.sources} />
    {job.status === 'ready' && <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary p-4">
      <p className="font-medium">Kiểm tra tên truyện, phạm vi và các chương trong kế hoạch trước khi bắt đầu.</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={isConfirmed} disabled={control.isPending} onChange={event => setIsConfirmed(event.target.checked)} className="mt-1" />
        Tôi có quyền sử dụng và đăng nội dung của tất cả nguồn trong đợt nhập này.</label>
      <p className="text-sm text-muted-foreground">Truyện mới chờ kiểm duyệt. Chương mới được lưu bản nháp, chờ kiểm duyệt.</p>
      <Button disabled={!isConfirmed || control.isPending} isLoading={control.isPending && control.variables?.action === 'start'} onClick={() => handleAction('start')}>Bắt đầu nhập</Button>
    </div>}
    <div className="flex flex-wrap gap-3">
      {canPause && <Button variant="outline" disabled={control.isPending} onClick={() => handleAction('pause')}>Tạm dừng</Button>}
      {job.status === 'paused' && <Button disabled={control.isPending} onClick={() => handleAction('resume')}>Tiếp tục</Button>}
      {['failed', 'completed_with_errors'].includes(job.status) && <Button disabled={control.isPending} onClick={() => handleAction('retry')}>Thử lại phần lỗi</Button>}
      {!isTerminal && <Button variant="outline" disabled={control.isPending} onClick={() => { control.reset(); setIsCancelConfirm(true) }}>Hủy đợt nhập</Button>}
    </div>
    {isCancelConfirm && !isTerminal && <div role="group" aria-label="Xác nhận hủy đợt nhập" className="space-y-3 rounded-xl border border-border p-4">
      <p>Dừng đợt nhập này? Những truyện và chương đã lưu được giữ nguyên.</p>
      <div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={control.isPending} onClick={() => handleAction('cancel')}>Xác nhận hủy</Button>
        <Button variant="outline" disabled={control.isPending} onClick={() => setIsCancelConfirm(false)}>Giữ đợt nhập</Button></div>
    </div>}
    {control.isPending && <p role="status" className="text-sm text-muted-foreground">Đang {actionLabels[control.variables.action]}…</p>}
    {control.error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">Không thể {actionLabels[control.variables?.action ?? 'start']}: {crawlErrorMessage(control.error)}</p>}
    <CrawlerJobTasks actorId={actorId} job={job} />
  </section>
}
