import React from 'react'

export const RankingSkeleton: React.FC = () => {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Đang tải dữ liệu bảng xếp hạng">
      {/* Top 3 Podium Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-end">
        {/* Rank 2 Skeleton */}
        <div className="xl:order-1 order-2 rounded-3xl border border-border bg-card p-6 shadow-sm animate-pulse flex flex-col justify-between h-72">
          <div className="flex gap-4">
            <div className="h-32 w-24 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3.5 w-1/2 rounded bg-muted" />
              <div className="h-6 w-24 rounded bg-muted mt-2" />
            </div>
          </div>
          <div className="h-4 w-full rounded bg-muted mt-4" />
          <div className="pt-3 border-t border-border flex justify-between">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        </div>

        {/* Rank 1 Skeleton (Elevated) */}
        <div className="xl:order-2 order-1 rounded-3xl border-2 border-primary/20 bg-card p-7 shadow-md animate-pulse flex flex-col justify-between h-80 xl:-translate-y-4">
          <div className="flex gap-4">
            <div className="h-40 w-28 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-6 w-5/6 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-8 w-28 rounded bg-muted mt-2" />
            </div>
          </div>
          <div className="space-y-1.5 mt-4">
            <div className="h-3.5 w-full rounded bg-muted" />
            <div className="h-3.5 w-4/5 rounded bg-muted" />
          </div>
          <div className="pt-4 border-t border-border flex justify-between">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-28 rounded bg-muted" />
          </div>
        </div>

        {/* Rank 3 Skeleton */}
        <div className="xl:order-3 order-3 rounded-3xl border border-border bg-card p-6 shadow-sm animate-pulse flex flex-col justify-between h-72">
          <div className="flex gap-4">
            <div className="h-32 w-24 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3.5 w-1/2 rounded bg-muted" />
              <div className="h-6 w-24 rounded bg-muted mt-2" />
            </div>
          </div>
          <div className="h-4 w-full rounded bg-muted mt-4" />
          <div className="pt-3 border-t border-border flex justify-between">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* List items Skeleton */}
      <div className="space-y-3 pt-4">
        {[4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
              <div className="h-16 w-12 shrink-0 rounded-lg bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-2/5 rounded bg-muted" />
                <div className="h-3 w-3/5 rounded bg-muted" />
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 shrink-0">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
