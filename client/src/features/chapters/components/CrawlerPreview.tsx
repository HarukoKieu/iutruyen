import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { CrawlImportInput, CrawlPreview } from '../api/crawler.api'

interface CrawlerPreviewProps {
  preview: CrawlPreview
  defaultOrder: number
  isBusy: boolean
  isSaved: boolean
  onSave: (input: CrawlImportInput) => void
}

export default function CrawlerPreview({ preview, defaultOrder, isBusy, isSaved, onSave }: CrawlerPreviewProps) {
  const [title, setTitle] = useState(preview.title)
  const [order, setOrder] = useState(String(defaultOrder))
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground'
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (rightsConfirmed) onSave({ previewToken: preview.previewToken, title: title.trim(), order: Number(order), rightsConfirmed: true })
  }
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Xem trước chương</h2>
      <p className="break-all text-sm text-muted-foreground">Nguồn: {preview.sourceUrl}</p>
      <p className="text-sm text-muted-foreground">{preview.wordCount.toLocaleString('vi-VN')} từ · Bản xem trước có hạn đến {new Date(preview.expiresAt).toLocaleTimeString('vi-VN')}.</p>
      <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-secondary p-4 leading-8" tabIndex={0} aria-label="Nội dung chương">
        {preview.text}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2">Tiêu đề chương
          <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} disabled={isBusy || isSaved} />
        </label>
        <label className="block space-y-2">Số thứ tự chương
          <input className={inputClass} type="number" min={1} max={1000000} step={1} value={order} onChange={e => setOrder(e.target.value)} required disabled={isBusy || isSaved} />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} disabled={isBusy || isSaved} className="mt-1" />
          Tôi có quyền sử dụng và đăng nội dung này trên website.
        </label>
        <p className="text-sm text-muted-foreground">Chương được lưu vào bản nháp, chờ kiểm duyệt. Bạn có thể sửa trong trình soạn thảo.</p>
        <Button type="submit" disabled={!rightsConfirmed || !title.trim() || isBusy || isSaved}>
          {isSaved ? 'Đã xử lý chương này' : 'Lưu bản nháp'}
        </Button>
      </form>
    </section>
  )
}
