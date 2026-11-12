import { Badge } from "./badge"
import { LineChartSupport } from "./line-chart-support"

export function MediaChartCard({
  title,
  value,
  previous,
  change,
  data,
  categories,
}: {
  title: string
  value: string
  previous?: string
  change?: string
  data: Array<Record<string, string | number>>
  categories: string[]
}) {
  return (
    <div className="transition">
      <div className="flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-2">
          <dt className="font-bold text-gray-900 sm:text-sm">{title}</dt>
          {change ? <Badge variant="neutral">{change}</Badge> : null}
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <dd className="text-xl text-gray-900">{value}</dd>
        {previous ? <dd className="text-sm text-gray-500">from {previous}</dd> : null}
      </div>
      <LineChartSupport
        className="mt-6 h-32"
        data={data}
        index="date"
        colors={["blue", "gray"]}
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
