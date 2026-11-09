import { Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdSlotProps {
  placement: 'site-banner' | 'reader-top' | 'reader-bottom'
  className?: string
}

const PLACEMENT_LABELS = {
  'site-banner': 'Quảng cáo trên website',
  'reader-top': 'Quảng cáo trước chương',
  'reader-bottom': 'Quảng cáo sau chương',
}

/** Reserved space only. A provider integration can later use the stable placement names. */
export default function AdSlot({ placement, className }: AdSlotProps) {
  if ((import.meta.env.VITE_ADS_MODE ?? 'placeholder') !== 'placeholder') return null

  return (
    <aside
      aria-label={PLACEMENT_LABELS[placement]}
      data-ad-placement={placement}
      className={cn('mx-auto w-full min-w-0 max-w-[970px]', className)}
    >
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Quảng cáo
      </p>
      <div className="flex h-[100px] items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-muted-foreground sm:h-[90px]">
        <Megaphone aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
        <span className="text-xs">Vị trí quảng cáo</span>
      </div>
    </aside>
  )
}
