import { useState } from 'react'
import { sourceDisplayName } from '@/features/stories/utils/storyAttribution'
import { Button } from '@/components/ui/button'
import { useGenres } from '@/features/stories/hooks/useGenres'
import { useUpdateStory } from '@/features/stories/hooks/useStoryMutations'
import type { UpdateStoryInput } from '@/types/story'
import { crawlErrorMessage, type CrawlStoryMetadata } from '../api/crawler.api'

interface CrawlerStoryPreviewProps {
  storyId?: string
  onApply?: (input: UpdateStoryInput) => void
  destinationTitle: string
  sourceUrl: string
  metadata: CrawlStoryMetadata
  isBusy: boolean
}

export default function CrawlerStoryPreview({ storyId, onApply, destinationTitle, sourceUrl, metadata, isBusy }: CrawlerStoryPreviewProps) {
  const { data: genres = [], isLoading, error: genresError } = useGenres()
  const update = useUpdateStory()
  const [title, setTitle] = useState(metadata.title)
  const [originalAuthor, setOriginalAuthor] = useState(metadata.author)
  const [sourceName, setSourceName] = useState(sourceDisplayName(sourceUrl))
  const [description, setDescription] = useState(metadata.description)
  const [status, setStatus] = useState(metadata.status ?? 'ongoing')
  const [fields, setFields] = useState({ title: !!metadata.title, description: !!metadata.description,
    status: !!metadata.status, cover: !!metadata.coverBase64, genres: false })
  const [genreIds, setGenreIds] = useState<string[] | null>(null)
  const [includeCredit, setIncludeCredit] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [validation, setValidation] = useState('')
  const normalized = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('vi')
  const matchedIds = genres.filter(genre => metadata.genres.some(name => normalized(name) === normalized(genre.name))).map(genre => genre._id)
  const selectedGenres = genreIds ?? matchedIds
  const unmatched = metadata.genres.filter(name => !genres.some(genre => normalized(name) === normalized(genre.name)))
  const disabled = isBusy || update.isPending
  const inputClass = 'mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground'
  const credit = [originalAuthor.trim() && `Tác giả gốc: ${originalAuthor.trim()}`, `Nguồn: ${sourceDisplayName(sourceName) || 'Sưu tầm'}`].filter(Boolean).join('\n')
  const toggle = (field: keyof typeof fields, label: string) => <label className="flex items-center gap-2 font-medium">
    <input type="checkbox" checked={fields[field]} onChange={e => { setFields(previous => ({ ...previous, [field]: e.target.checked })); update.reset() }} />{label}
  </label>
  const handleSave = () => {
    if (!confirmed || disabled) return
    const input: UpdateStoryInput = { originalAuthor: originalAuthor.trim(), sourceName: sourceDisplayName(sourceName) || 'Sưu tầm' }
    if (fields.title) input.title = title.trim()
    if (fields.description) input.description = `${description.trim()}${includeCredit ? `\n\n${credit}` : ''}`
    if (fields.status) input.status = status
    if (fields.cover && metadata.coverBase64) input.coverBase64 = metadata.coverBase64
    if (fields.genres) input.genreIds = selectedGenres
    if (!Object.keys(input).length) { setValidation('Chọn ít nhất một thông tin cần lưu.'); return }
    if (input.title !== undefined && (input.title.length < 3 || input.title.length > 150)) { setValidation('Tên truyện cần từ 3 đến 150 ký tự.'); return }
    if (input.description !== undefined && (input.description.length < 10 || input.description.length > 5000)) { setValidation('Giới thiệu (kể cả tác giả và nguồn) cần từ 10 đến 5.000 ký tự.'); return }
    if (fields.genres && (!selectedGenres.length || isLoading || genresError)) { setValidation('Chọn ít nhất một thể loại của website sau khi danh sách tải thành công.'); return }
    setValidation('')
    if (onApply) { onApply(input); setConfirmed(false); return }
    if (!storyId) return
    update.mutate({ id: storyId, input }, { onSuccess: () => setConfirmed(false) })
  }
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold">Thông tin truyện từ nguồn</h2>
    <p className="text-sm text-muted-foreground">{onApply ? 'Các mục được chọn sẽ thay thế nội dung tương ứng trong form bên dưới. Truyện chỉ được lưu khi bạn bấm Tạo truyện.' : `Các mục được chọn sẽ thay thế thông tin của “${destinationTitle}” khi bạn bấm lưu.`} Bỏ chọn để giữ giá trị hiện tại.</p>
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <div>{toggle('title', 'Áp dụng tên truyện')}<input aria-label="Tên truyện từ nguồn" className={inputClass} value={title} maxLength={150} onChange={e => setTitle(e.target.value)} /></div>
      <div>{toggle('description', 'Áp dụng giới thiệu')}<textarea aria-label="Giới thiệu từ nguồn" rows={7} className={inputClass} value={description} maxLength={5000} onChange={e => setDescription(e.target.value)} /></div>
      <label className="block">Tác giả gốc<input className={inputClass} value={originalAuthor} maxLength={200} onChange={e => setOriginalAuthor(e.target.value)} placeholder="Chưa rõ tác giả" /></label>
      <label className="block">Nguồn truyện<input className={inputClass} value={sourceName} maxLength={2048} onChange={e => setSourceName(e.target.value)} placeholder="Sưu tầm" /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={includeCredit} onChange={e => setIncludeCredit(e.target.checked)} />Ghi tác giả gốc và tên nguồn vào cuối giới thiệu</label>
      <p className="text-sm text-muted-foreground">Tác giả gốc và nguồn được lưu riêng. Để trống nguồn sẽ ghi “Sưu tầm”; người đăng không hiển thị trong thông tin tác giả.</p>
      <div>{toggle('status', 'Áp dụng trạng thái')}<p className="text-sm text-muted-foreground">Nguồn: {metadata.rawStatus || 'Chưa rõ'}</p>
        <select aria-label="Trạng thái truyện từ nguồn" className={inputClass} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
          <option value="ongoing">Đang ra</option><option value="completed">Hoàn thành</option><option value="hiatus">Tạm ngưng</option>
        </select>
      </div>
      <div>{toggle('genres', 'Áp dụng thể loại')}<p className="text-sm text-muted-foreground">Thể loại nguồn: {metadata.genres.join(', ') || 'Chưa rõ'}</p>
        {unmatched.length > 0 && <p className="text-sm text-muted-foreground">Chưa khớp trong website: {unmatched.join(', ')}. Chọn thể loại phù hợp bên dưới.</p>}
        {isLoading ? <p role="status">Đang tải thể loại…</p> : genresError ? <p role="alert">Không tải được thể loại. Các thông tin khác vẫn có thể lưu.</p>
          : <div className="mt-2 flex flex-wrap gap-3">{genres.map(genre => <label key={genre._id} className="flex items-center gap-2">
            <input type="checkbox" checked={selectedGenres.includes(genre._id)} onChange={e => setGenreIds(e.target.checked ? [...selectedGenres, genre._id] : selectedGenres.filter(id => id !== genre._id))} />{genre.name}
          </label>)}</div>}
      </div>
      {metadata.coverBase64 && <div>{toggle('cover', 'Áp dụng ảnh bìa')}<img src={metadata.coverBase64} alt="Ảnh bìa từ nguồn" className="mt-2 h-48 w-32 rounded-none object-cover" /></div>}
      {metadata.coverWarning && <p role="status" className="text-sm text-muted-foreground">{metadata.coverWarning}</p>}
      {metadata.truncated && <p role="status">Thông tin nguồn dài hơn giới hạn. Hãy kiểm tra và chỉnh sửa phần đã rút gọn trước khi lưu.</p>}
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); update.reset() }} />Tôi có quyền sử dụng thông tin này và đồng ý cập nhật các mục đã chọn cho truyện hiện tại.</label>
      <Button type="button" disabled={!confirmed || disabled} isLoading={update.isPending} onClick={handleSave}>{onApply ? 'Điền vào form tạo truyện' : 'Lưu thông tin truyện'}</Button>
    </fieldset>
    {(validation || update.error) && <p role="alert" className="text-destructive">{validation || crawlErrorMessage(update.error)}</p>}
    {update.isSuccess && <p role="status">Đã lưu thông tin truyện.</p>}
  </section>
}
