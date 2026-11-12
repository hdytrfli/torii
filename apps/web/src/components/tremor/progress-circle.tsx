import { cn } from "../../lib/format"

export function ProgressCircle({
  value,
  radius = 45,
  strokeWidth = 7,
  className,
}: {
  value: number
  radius?: number
  strokeWidth?: number
  className?: string
}) {
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <svg
      width={radius * 2}
      height={radius * 2}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      className={cn("-rotate-90 transform", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      tremor-id="tremor-raw"
    >
      <circle
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        strokeWidth={strokeWidth}
        fill="transparent"
        className="stroke-gray-100"
      />
      <circle
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        fill="transparent"
        strokeLinecap="round"
        className="stroke-gray-900 transition-all duration-300 ease-in-out"
      />
    </svg>
  )
}
