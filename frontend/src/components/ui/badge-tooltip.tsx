import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

interface BadgeWithTooltipProps {
  name: string
  description?: string | null
  color: string
  className?: string
}

export function BadgeWithTooltip({ name, description, color, className }: BadgeWithTooltipProps) {
  if (!description) {
    // No tooltip if no description
    return (
      <span
        className={cn(
          "text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border cursor-default",
          className
        )}
        style={{ color, borderColor: color }}
      >
        {name}
      </span>
    )
  }

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            className={cn(
              "text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border cursor-help transition-opacity hover:opacity-80",
              className
            )}
            style={{ color, borderColor: color }}
          >
            {name}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            sideOffset={5}
          >
            <div className="space-y-1">
              <p className="font-medium" style={{ color }}>{name}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <TooltipPrimitive.Arrow className="fill-popover" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
