import { cn } from "../../lib/format"

const colors: Record<string, string> = {
  blue: "bg-blue-500",
  lightGray: "bg-gray-400",
  red: "bg-red-500",
  emerald: "bg-emerald-500",
  yellow: "bg-yellow-500",
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
