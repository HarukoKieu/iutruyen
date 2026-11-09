import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useGenres } from '@/features/stories/hooks/useGenres'
import type { CrawlerJob, CrawlerJobSourceInput } from '@/types/crawler-job'
import { useCrawlerTargets, usePrepareCrawlerJob } from '../hooks/useCrawlerJobs'
import { crawlErrorMessage } from '../api/crawler.api'
import CrawlerSourceRow, { type CrawlerSourceDraft } from './CrawlerSourceRow'

interface CrawlerJobFormProps { actorId: string; initialStoryId?: string; initialUrl?: string; onPrepared: (job: CrawlerJob) => void }
const newRow = (key: number, storyId = '', url = ''): CrawlerSourceDraft => ({ key, url, destination: storyId ? 'existing' : 'new', storyId, storyTitle: '', genreIds: [], from: '1', to: '2000', startOrder: '1' })

export default function CrawlerJobForm({ actorId, initialStoryId, initialUrl, onPrepared }: CrawlerJobFormProps) {
  const [rows, setRows] = useState<CrawlerSourceDraft[]>(() => [newRow(1, initialStoryId, initialUrl)])
  const nextRow = useRef(2)
  const request = useRef<{ signature: string; requestKey: string } | null>(null)
  const [validation, setValidation] = useState('')
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [pastedUrls, setPastedUrls] = useState('')
  const stories = useCrawlerTargets(actorId, search)
  const genres = useGenres()
  const prepare = usePrepareCrawlerJob(actorId)
  const loadedStories = stories.data?.pages.flatMap(page => page.targets) ?? []
  const handlePaste = () => {
    const urls = pastedUrls.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    if (!urls.length) { setValidation('Dán ít nhất một URL truyện, mỗi dòng một URL.'); return }
    const blankIndex = rows.findIndex(row => !row.url.trim())
    if (rows.length + urls.length - (blankIndex >= 0 ? 1 : 0) > 20) { setValidation('Mỗi đợt nhập tối đa 20 nguồn. Bớt URL hoặc chia thành các đợt nhỏ hơn.'); return }
    const template = rows[0]
    const added = urls.map(url => ({ ...newRow(nextRow.current++, '', url), destination: 'new' as const, genreIds: [...template.genreIds], from: template.from, to: template.to, startOrder: template.startOrder }))
    setRows(previous => blankIndex < 0 ? [...previous, ...added] : [...previous.map((row, index) => index === blankIndex ? { ...row, url: urls[0] } : row), ...added.slice(1)])
    setPastedUrls(''); setValidation(''); prepare.reset()
  }
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (prepare.isPending) return
    const sources: CrawlerJobSourceInput[] = []
    const urls = new Set<string>()
    const destinationIds = new Set<string>()
    for (const [index, row] of rows.entries()) {
      const url = row.url.trim()
      let parsed: URL
      try { parsed = new URL(url) } catch { setValidation(`Nguồn ${index + 1}: nhập URL truyện hợp lệ.`); return }
      if (parsed.protocol !== 'https:' || url.length > 2048) { setValidation(`Nguồn ${index + 1}: cần URL HTTPS tối đa 2.048 ký tự.`); return }
      parsed.hash = ''
      if (urls.has(parsed.href)) { setValidation(`Nguồn ${index + 1}: URL này đã xuất hiện trong đợt nhập.`); return }
      urls.add(parsed.href)
      const from = Number(row.from), to = row.to.trim() ? Number(row.to) : undefined, startOrder = Number(row.startOrder)
      if (!Number.isInteger(from) || from < 1 || from > 2000 || (to !== undefined && (!Number.isInteger(to) || to < from || to > 2000))) {
        setValidation(`Nguồn ${index + 1}: phạm vi cần từ 1 đến 2.000, vị trí cuối không nhỏ hơn vị trí đầu.`); return
      }
      if (!Number.isSafeInteger(startOrder) || startOrder < 1 || startOrder + (to ?? 2000) - from > 1000000) { setValidation(`Nguồn ${index + 1}: toàn bộ số chương đích cần từ 1 đến 1.000.000.`); return }
      if (row.destination === 'existing' && !row.storyId) { setValidation(`Nguồn ${index + 1}: chọn truyện đã có.`); return }
      if (row.destination === 'existing' && destinationIds.has(row.storyId)) { setValidation(`Nguồn ${index + 1}: mỗi truyện đích chỉ được chọn một lần trong đợt nhập.`); return }
      if (row.destination === 'existing') destinationIds.add(row.storyId)
      if (row.destination === 'new' && row.genreIds.length > 20) { setValidation(`Nguồn ${index + 1}: chọn tối đa 20 thể loại.`); return }
      sources.push({ url, from, ...(to === undefined ? {} : { to }), startOrder, ...(row.destination === 'existing' ? { storyId: row.storyId } : row.genreIds.length ? { genreIds: row.genreIds } : {}) })
    }
    const signature = JSON.stringify(sources)
    if (request.current?.signature !== signature) request.current = { signature, requestKey: crypto.randomUUID() }
    setValidation('')
    prepare.mutate({ requestKey: request.current.requestKey, sources }, { onSuccess: job => { request.current = null; onPrepared(job) } })
  }
  const handleChange = (key: number, update: Partial<CrawlerSourceDraft>) => {
    setRows(previous => previous.map(row => row.key === key ? { ...row, ...update } : row))
    setValidation(''); prepare.reset()
  }
  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="prepare-title">
    <div><h2 id="prepare-title" className="font-serif text-xl font-bold">Chuẩn bị đợt nhập</h2>
      <p className="mt-2 text-sm text-muted-foreground">Tối đa 20 truyện, 2.000 chương mỗi truyện và 10.000 chương mỗi đợt. Mỗi tài khoản có một đợt đang hoạt động.</p>
      <p className="mt-1 text-sm text-muted-foreground">Hệ thống nhận diện truyện đã có theo URL nguồn để nhập thêm chương. Chương có URL hoặc số chương đích đã tồn tại sẽ được bỏ qua, giữ nguyên nội dung hiện có.</p>
      <p className="mt-1 text-sm text-muted-foreground">Bước này lấy thông tin và mục lục để bạn kiểm tra. Truyện và chương chỉ được lưu sau khi bạn xác nhận bắt đầu.</p></div>
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={prepare.isPending} className="space-y-3">
        <label className="block text-sm font-medium">Dán nhiều URL (mỗi dòng một truyện)
          <textarea rows={3} maxLength={42000} value={pastedUrls} onChange={event => setPastedUrls(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="https://nguon-truyen/truyen-1/" />
        </label>
        <Button type="button" variant="outline" onClick={handlePaste}>Thêm các URL</Button>
        <p className="text-sm text-muted-foreground">Các dòng mới tự nhận diện truyện đã có theo URL nguồn và chỉ tạo mới khi chưa có. Thể loại và phạm vi lấy từ nguồn đầu tiên; kiểm tra từng đích nhập trước khi lấy kế hoạch.</p>
      </fieldset>
      <fieldset disabled={prepare.isPending} className="space-y-3">
        <label className="block text-sm font-medium">Tìm truyện đã có
          <input value={searchText} maxLength={200} onChange={event => setSearchText(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="Nhập tên truyện của bạn" />
        </label>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setSearch(searchText.trim())}>Tìm truyện</Button>
          {stories.hasNextPage && <Button type="button" variant="outline" isLoading={stories.isFetchingNextPage} onClick={() => void stories.fetchNextPage()}>Tải thêm truyện</Button>}</div>
      </fieldset>
      {stories.isLoading && <p role="status" className="text-sm text-muted-foreground">Đang tải truyện của bạn…</p>}
      {stories.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{crawlErrorMessage(stories.error)}</p><Button type="button" variant="outline" onClick={() => void stories.refetch()}>Thử tải truyện lại</Button></div>}
      {genres.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Không tải được thể loại cho truyện mới.</p><Button type="button" variant="outline" onClick={() => void genres.refetch()}>Thử tải thể loại lại</Button></div>}
      {rows.map((row, index) => <CrawlerSourceRow key={row.key} row={row} index={index} stories={loadedStories} genres={genres.data ?? []} isBusy={prepare.isPending} canRemove={rows.length > 1}
        onChange={update => handleChange(row.key, update)} onRemove={() => { setRows(previous => previous.filter(item => item.key !== row.key)); setValidation(''); prepare.reset() }} />)}
      {(validation || prepare.error) && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{validation || crawlErrorMessage(prepare.error)}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={rows.length >= 20 || prepare.isPending} onClick={() => setRows(previous => [...previous, newRow(nextRow.current++)])}>Thêm nguồn truyện</Button>
        <Button type="submit" isLoading={prepare.isPending}>Lấy kế hoạch nhập</Button>
      </div>
    </form>
  </section>
}
