import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Bell, ClipboardList, Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task, TaskReminder, Project } from "@shared/schema";

export type CalendarEvent = {
  id: string;
  type: "task" | "reminder" | "deadline";
  title: string;
  date: Date;
  originalData: any;
  projectId?: number;
  projectName?: string;
  status?: string;
};

interface CalendarItemProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

export function CalendarItem({ event, onClick }: CalendarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      e.stopPropagation();
      onClick(event);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onClick={handleClick}
          className={cn(
            "text-xs p-1 rounded cursor-pointer hover:ring-1 hover:ring-primary/50 flex items-center gap-1 truncate transition-all",
            event.type === "task" && "bg-chart-4/20 text-chart-4 border border-chart-4/30",
            event.type === "reminder" && "bg-chart-3/20 text-chart-3 border border-chart-3/30",
            event.type === "deadline" && "bg-destructive/20 text-destructive border border-destructive/30",
            event.status === "done" && "opacity-50 line-through",
            isDragging && "opacity-50 shadow-lg cursor-grabbing"
          )}
          data-testid={`calendar-item-${event.id}`}
        >
          <GripVertical className="h-3 w-3 flex-shrink-0 opacity-50" />
          {event.type === "task" && <ClipboardList className="h-3 w-3 flex-shrink-0" />}
          {event.type === "reminder" && <Bell className="h-3 w-3 flex-shrink-0" />}
          <span className="truncate">{event.title}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{event.title}</p>
          {event.projectName && (
            <p className="text-xs text-muted-foreground">Project: {event.projectName}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {format(event.date, "MMM d, yyyy")}
            {event.type === "reminder" && ` at ${format(event.date, "h:mm a")}`}
          </p>
          {event.status && (
            <p className="text-xs capitalize">Status: {event.status.replace(/_/g, " ")}</p>
          )}
          <p className="text-xs text-muted-foreground italic">Click to view, drag to reschedule</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface CalendarItemCardProps {
  event: CalendarEvent;
  isDragging?: boolean;
}

export function CalendarItemCard({ event, isDragging }: CalendarItemCardProps) {
  return (
    <div
      className={cn(
        "text-xs p-2 rounded shadow-lg flex items-center gap-1 bg-card border",
        event.type === "task" && "border-chart-4",
        event.type === "reminder" && "border-chart-3",
        event.type === "deadline" && "border-destructive",
        isDragging && "rotate-3"
      )}
    >
      {event.type === "task" && <ClipboardList className="h-3 w-3 flex-shrink-0" />}
      {event.type === "reminder" && <Bell className="h-3 w-3 flex-shrink-0" />}
      <span className="truncate max-w-[150px]">{event.title}</span>
    </div>
  );
}
