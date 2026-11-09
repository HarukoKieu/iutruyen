import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Eye, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'
import type { SiteConfig } from '../types'

function ConfigForm({ config }: { config: SiteConfig }) {
  const client = useQueryClient()
  const [siteName, setSiteName] = useState(config.siteName)
  const [description, setDescription] = useState(config.description)
  const [announcement, setAnnouncement] = useState(config.announcement)
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: adminApi.saveConfig,
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin'] }),
        client.invalidateQueries({ queryKey: ['site-config'] }),
      ])
    },
  })

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        mutation.mutate({
          expectedVersion: config.version,
          siteName,
          description,
          announcement,
          reason,
        })
      }}
      className="max-w-3xl space-y-6"
    >
      {/* Version note banner */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs sm:text-sm text-muted-foreground shadow-xs">
        <Settings className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground mb-0.5">
            Cấu hình hiển thị, phiên bản {config.version}. Không thay đổi cấu hình SEO, xác thực hay secret hệ thống.
          </p>
          <p className="text-xs text-muted-foreground">
            Mọi thay đổi cấu hình được lưu vào cơ sở dữ liệu và yêu cầu nêu rõ lý do để lưu audit log.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span>Thông tin chung trang web</span>
        </h3>

        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          <span className="flex justify-between">
            <span>Tên site</span>
            <span className="text-xs text-muted-foreground font-mono">{siteName.length}/100</span>
          </span>
          <input
            required
            maxLength={100}
            value={siteName}
            onChange={event => setSiteName(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          <span className="flex justify-between">
            <span>Mô tả</span>
            <span className="text-xs text-muted-foreground font-mono">{description.length}/500</span>
          </span>
          <textarea
            maxLength={500}
            rows={3}
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          <span className="flex justify-between">
            <span>Thông báo text thuần</span>
            <span className="text-xs text-muted-foreground font-mono">{announcement.length}/1000</span>
          </span>
          <textarea
            maxLength={1000}
            rows={4}
            value={announcement}
            onChange={event => setAnnouncement(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      {/* Live Preview Card */}
      <aside
        aria-label="Xem trước cấu hình"
        className="rounded-xl border border-border bg-surface-raised/40 p-5 shadow-xs break-words space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Eye className="h-4 w-4 text-indigo-500" />
          <span>Xem trước cấu hình</span>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-lg font-bold text-foreground font-serif">{siteName}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
          {announcement && (
            <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs sm:text-sm text-sky-950 dark:text-sky-200">
              <p className="whitespace-pre-wrap">{announcement}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Audit Reason & Submit Section */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          <span className="flex justify-between">
            <span className="text-foreground">Lý do</span>
            <span className="text-xs text-muted-foreground font-mono">{reason.length}/500 (tối thiểu 10 ký tự)</span>
          </span>
          <input
            required
            minLength={10}
            maxLength={500}
            placeholder="Nêu rõ mục đích và lý do cập nhật cấu hình hệ thống…"
            value={reason}
            onChange={event => setReason(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {mutation.isError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
            {adminError(mutation.error)}
          </div>
        )}

        {mutation.isSuccess && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Lưu cấu hình thành công! Phiên bản mới đã được cập nhật.</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={mutation.isPending || reason.trim().length < 10}
            className="rounded-lg px-6 font-semibold flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span>{mutation.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}</span>
          </Button>
        </div>
      </div>
    </form>
  )
}

export default function AdminConfigPage() {
  const query = useAdminQuery('config', {}, adminApi.config)

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
            Cấu hình hiển thị
          </h2>
          <p className="text-xs text-muted-foreground">
            Quản trị thông tin nhận diện thương hiệu, mô tả site và thông báo công khai
          </p>
        </div>
      </div>

      {query.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-xs">
          <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải…</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Lỗi tải cấu hình</p>
          <p>{adminError(query.error)}</p>
        </div>
      ) : (
        <ConfigForm key={query.data.version} config={query.data} />
      )}
    </section>
  )
}

