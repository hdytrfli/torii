import { LineChartSupport } from "./line-chart-support"
import type { AvailableChartColorsKeys } from "../../lib/chart-utils"

export function MediaChartCard({
  title,
  value,
  previous,
  data,
  categories,
  colors = ["blue", "gray"] as AvailableChartColorsKeys[],
}: {
  title: string
  value: string
  previous?: string
  data: Array<Record<string, string | number>>
  categories: string[]
  colors?: AvailableChartColorsKeys[]
}) {
  return (
    <div className="transition">
      <div className="flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-2">
          <dt className="font-bold text-ink sm:text-sm">{title}</dt>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <dd className="text-xl text-ink">{value}</dd>
        {previous ? <dd className="text-sm text-ink-muted">from {previous}</dd> : null}
      </div>
      <LineChartSupport
        className="mt-6 h-32"
        data={data}
        index="date"
        colors={colors}
        startEndOnly
        valueFormatter={(number: number) => Intl.NumberFormat("us").format(number)}
        showYAxis={false}
        showLegend={false}
        categories={categories}
        showTooltip={false}
      />
    </div>
  )
}
