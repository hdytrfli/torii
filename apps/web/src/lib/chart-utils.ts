// Tremor chartColors [v0.1.0]

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: {
    bg: "bg-info",
    stroke: "stroke-info",
    fill: "fill-info",
    text: "text-info",
  },
  emerald: {
    bg: "bg-success",
    stroke: "stroke-success",
    fill: "fill-success",
    text: "text-success",
  },
  violet: {
    bg: "bg-pending",
    stroke: "stroke-pending",
    fill: "fill-pending",
    text: "text-pending",
  },
  amber: {
    bg: "bg-warning",
    stroke: "stroke-warning",
    fill: "fill-warning",
    text: "text-warning",
  },
  gray: {
    bg: "bg-ink-muted/60",
    stroke: "stroke-ink-muted/60",
    fill: "fill-ink-muted/60",
    text: "text-ink-muted/60",
  },
  lightGray: {
    bg: "bg-ink-muted/40 dark:bg-ink-muted/50",
    stroke: "stroke-ink-muted/40 dark:stroke-ink-muted/50",
    fill: "fill-ink-muted/40 dark:fill-ink-muted/50",
    text: "text-ink-muted/40 dark:text-ink-muted/50",
  },
  cyan: {
    bg: "bg-info",
    stroke: "stroke-info",
    fill: "fill-info",
    text: "text-info",
  },
  pink: {
    bg: "bg-pending",
    stroke: "stroke-pending",
    fill: "fill-pending",
    text: "text-pending",
  },
  lime: {
    bg: "bg-success",
    stroke: "stroke-success",
    fill: "fill-success",
    text: "text-success",
  },
  fuchsia: {
    bg: "bg-warning",
    stroke: "stroke-warning",
    fill: "fill-warning",
    text: "text-warning",
  },
  red: {
    bg: "bg-danger",
    stroke: "stroke-danger",
    fill: "fill-danger",
    text: "text-danger",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-ink-muted/60",
    stroke: "stroke-ink-muted/60",
    fill: "fill-ink-muted/60",
    text: "text-ink-muted/60",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

// Tremor getYAxisDomain [v0.0.0]

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0)
  const maxDomain = maxValue ?? "auto"
  return [minDomain, maxDomain]
}

// Tremor hasOnlyOneValueForKey [v0.1.0]

export function hasOnlyOneValueForKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: any[],
  keyToCheck: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val: any[] = []

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck])
      if (val.length > 1) {
        return false
      }
    }
  }

  return true
}
