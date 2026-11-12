import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"
import { cn } from "../../lib/format"
import { Card } from "./card"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"

type HoverPopoverContextValue = {
  activeId: string | null
  setActiveId: (id: string | null) => void
  close: (id: string) => void
}

const HoverPopoverContext = createContext<HoverPopoverContextValue | null>(null)

export function HoverPopoverProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const value = useMemo(
    () => ({
      activeId,
      setActiveId,
      close: (id: string) => {
        setActiveId((current) => (current === id ? null : current))
      },
    }),
    [activeId],
  )
  return <HoverPopoverContext.Provider value={value}>{children}</HoverPopoverContext.Provider>
}

export function HoverPopover({
  id,
  children,
  content,
  side = "bottom",
  align = "start",
  delay = 0,
  closeDelay = 100,
  contentClassName,
}: {
  id: string
  children: ReactElement
  content: ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delay?: number
  closeDelay?: number
  contentClassName?: string
}) {
  const context = useContext(HoverPopoverContext)
  if (!context) {
    throw new Error("HoverPopover must be used inside HoverPopoverProvider")
  }

  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current)
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const openNow = () => {
    cancelClose()
    context.setActiveId(id)
  }

  const closeNow = () => {
    context.close(id)
  }

  const scheduleOpen = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current)
    cancelClose()
    if (delay <= 0) {
      openNow()
      return
    }
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null
      openNow()
    }, delay)
  }

  const scheduleClose = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
    cancelClose()
    if (closeDelay <= 0) {
      closeNow()
      return
    }
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      closeNow()
    }, closeDelay)
  }

  const childProps = (children as ReactElement<Record<string, unknown>>).props
  const callChild = (name: string, event: unknown) => {
    const handler = childProps[name]
    if (typeof handler === "function") handler(event)
  }

  const anchor = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onMouseEnter: (event: React.MouseEvent) => {
      callChild("onMouseEnter", event)
      scheduleOpen()
    },
    onMouseLeave: (event: React.MouseEvent) => {
      callChild("onMouseLeave", event)
      scheduleClose()
    },
    onFocus: (event: React.FocusEvent) => {
      callChild("onFocus", event)
      scheduleOpen()
    },
    onBlur: (event: React.FocusEvent) => {
      callChild("onBlur", event)
      scheduleClose()
    },
  })

  return (
    <Popover
      open={context.activeId === id}
      onOpenChange={(open) => {
        if (open) context.setActiveId(id)
        else context.close(id)
      }}
    >
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "border-0 bg-transparent p-0 shadow-none",
          context.activeId === id ? "pointer-events-auto" : "pointer-events-none",
          contentClassName,
        )}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Card className="overflow-hidden p-0">{content}</Card>
      </PopoverContent>
    </Popover>
  )
}
