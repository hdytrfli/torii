export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100
      const y = 40 - (value / max) * 34
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox="0 0 100 40" className="h-28 w-full" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="#1B1B1B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
