import { cn } from "../../lib/format"

const colors: Record<string, string> = {
  blue: "bg-gray-900",
  lightGray: "bg-gray-400",
  red: "bg-gray-200",
  emerald: "bg-gray-600",
  yellow: "bg-gray-300",
}

export function CategoryBar({
  values,
  colors: keys = ["blue", "lightGray", "red"],
  className,
}: {
  values: number[]
  colors?: string[]
  className?: string
}) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1
  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-sm", className)}>
      {values.map((value, index) => (
        <div
          key={index}
          className={cn("h-full", colors[keys[index] ?? "lightGray"] ?? "bg-gray-400")}
          style={{ width: `${(value / total) * 100}%` }}
        />
      ))}
    </div>
  )
}
