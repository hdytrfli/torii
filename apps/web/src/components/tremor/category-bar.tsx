import { cn } from "../../lib/format"

const colors: Record<string, string> = {
  blue: "bg-brand",
  lightGray: "bg-ink-muted/50",
  red: "bg-danger",
  emerald: "bg-success",
  yellow: "bg-warning",
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
          className={cn("h-full", colors[keys[index] ?? "lightGray"] ?? "bg-ink-muted")}
          style={{ width: `${(value / total) * 100}%` }}
        />
      ))}
    </div>
  )
}
