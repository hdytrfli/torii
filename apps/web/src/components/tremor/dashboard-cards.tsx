import { ProgressBar } from "./progress-bar"

export type KpiEntry = {
  title: string
  percentage: number
  current: number
  allowed: number
  unit?: string
}

export function ProgressBarCard({
  title,
  value,
  valueDescription,
  ctaDescription,
  ctaText,
  data,
}: {
  title: string
  value: string
  valueDescription: string
  ctaDescription: string
  ctaText: string
  data: KpiEntry[]
}) {
  return (
    <div className="flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2">
          <dt className="font-bold text-ink sm:text-sm">{title}</dt>
        </div>
        <dd className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-ink">{value}</span>
          <span className="text-sm text-ink-muted">{valueDescription}</span>
        </dd>
        <ul role="list" className="mt-4 space-y-5">
          {data.map((item) => (
            <li key={item.title}>
              <p className="flex justify-between text-sm">
                <span className="font-medium text-ink">{item.title}</span>
                <span className="font-medium text-ink">
                  {item.current}
                  <span className="font-normal text-ink-muted">
                    /{item.allowed}
                    {item.unit}
                  </span>
                </span>
              </p>
              <ProgressBar value={item.percentage} className="mt-2 [&>*]:h-1.5" />
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        {ctaDescription} <span className="font-medium text-ink">{ctaText}</span>
      </p>
    </div>
  )
}

export type KpiEntryExtended = {
  title: string
  percentage: number
  value: string
  color: string
}

export function CategoryBarCard({
  title,
  value,
  valueDescription,
  subtitle,
  ctaDescription,
  ctaText,
  data,
}: {
  title: string
  value: string
  valueDescription: string
  subtitle: string
  ctaDescription: string
  ctaText: string
  data: KpiEntryExtended[]
}) {
  return (
    <div className="flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-ink sm:text-sm">{title}</h3>
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-ink">{value}</span>
          <span className="text-sm text-ink-muted">{valueDescription}</span>
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">{subtitle}</p>
          <div className="mt-2 flex items-center gap-0.5">
            {data.map((item) => (
              <div
                key={item.title}
                className={`${item.color} h-1.5 rounded-full`}
                style={{ width: `${item.percentage}%` }}
              />
            ))}
          </div>
        </div>
        <ul role="list" className="mt-5 space-y-2">
          {data.map((item) => (
            <li key={item.title} className="flex items-center gap-2 text-xs">
              <span className={`${item.color} size-2.5 rounded-sm`} aria-hidden="true" />
              <span className="text-ink">{item.title}</span>
              <span className="text-ink-muted">
                ({item.value} / {Math.round(item.percentage)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        {ctaDescription} <span className="font-medium text-ink">{ctaText}</span>
      </p>
    </div>
  )
}
