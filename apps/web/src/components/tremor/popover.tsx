// Tremor Raw Popover [v0.0.0]

import * as PopoverPrimitives from "@radix-ui/react-popover"
import * as React from "react"

import { cn } from "../../lib/format"

const Popover = (
  props: React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Root>,
) => {
  return <PopoverPrimitives.Root {...props} />
}

Popover.displayName = "Popover"

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Trigger>
>((props, forwardedRef) => {
  return <PopoverPrimitives.Trigger ref={forwardedRef} {...props} />
})

PopoverTrigger.displayName = "PopoverTrigger"

const PopoverAnchor = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitives.Anchor>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Anchor>
>((props, forwardedRef) => {
  return <PopoverPrimitives.Anchor ref={forwardedRef} {...props} />
})

PopoverAnchor.displayName = "PopoverAnchor"

const PopoverClose = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Close>
>((props, forwardedRef) => {
  return <PopoverPrimitives.Close ref={forwardedRef} {...props} />
})

PopoverClose.displayName = "PopoverClose"

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitives.Content>
>(
  (
    {
      className,
      sideOffset = 10,
      side = "bottom",
      align = "center",
      collisionPadding,
      ...props
    },
    forwardedRef,
  ) => {
    return (
      <PopoverPrimitives.Portal>
        <PopoverPrimitives.Content
          ref={forwardedRef}
          sideOffset={sideOffset}
          side={side}
          align={align}
          collisionPadding={collisionPadding}
          avoidCollisions
          className={cn(
            "torii-popover z-50 max-h-[var(--radix-popper-available-height)] min-w-60 overflow-hidden rounded-md border border-line bg-surface p-2.5 text-sm text-ink shadow-md outline-none",
            className,
          )}
          {...props}
        />
      </PopoverPrimitives.Portal>
    )
  },
)

PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger }
