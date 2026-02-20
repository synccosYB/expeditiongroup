import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarItem, type CalendarEvent } from "./calendar-item";

interface CalendarDayProps {
  day: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  viewMode: "month" | "week";
  onEventClick?: (event: CalendarEvent) => void;
}

export function CalendarDay({ day, events, isCurrentMonth, isToday, viewMode, onEventClick }: CalendarDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(day, "yyyy-MM-dd")}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r border-b last:border-r-0 p-1 transition-all duration-150",
        viewMode === "week" ? "min-h-[400px]" : "min-h-[100px]",
        !isCurrentMonth && "bg-muted/30",
        isOver && "bg-primary/15 ring-2 ring-inset ring-primary/40",
        isToday && !isOver && "bg-primary/5"
      )}
      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
    >
      <div className={cn(
        "text-sm font-medium mb-1 h-6 w-6 flex items-center justify-center rounded-full",
        isToday && "bg-primary text-primary-foreground",
        !isCurrentMonth && "text-muted-foreground"
      )}>
        {format(day, "d")}
      </div>
      <div className="space-y-1 overflow-y-auto max-h-[calc(100%-28px)]">
        {events.slice(0, viewMode === "week" ? 20 : 3).map((event) => (
          <CalendarItem key={event.id} event={event} onClick={onEventClick} />
        ))}
        {events.length > (viewMode === "week" ? 20 : 3) && (
          <div className="text-xs text-muted-foreground pl-1">
            +{events.length - (viewMode === "week" ? 20 : 3)} more
          </div>
        )}
      </div>
    </div>
  );
}
