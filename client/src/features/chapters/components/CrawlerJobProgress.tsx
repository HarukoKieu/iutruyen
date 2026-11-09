interface CrawlerJobProgressProps { label: string; value: number; max: number }

export default function CrawlerJobProgress({ label, value, max }: CrawlerJobProgressProps) {
  const maximum = Math.max(1, max)
  const current = Math.max(0, Math.min(value, maximum))
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={current}
    className="h-3 w-full overflow-hidden rounded-full bg-secondary">
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${current / maximum * 100}%` }} />
  </div>
}
