import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addWeeks, subWeeks, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bell, ClipboardList, Clock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarDay } from "./calendar-day";
import { CalendarItem, CalendarItemCard } from "./calendar-item";
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

type ViewMode = "month" | "week";

export function CalendarView() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const { data: calendarData, isLoading } = useQuery<{
    tasks: (Task & { project: Project })[];
    reminders: (TaskReminder & { task: Task; project: Project })[];
  }>({
    queryKey: ["/api/calendar/events", format(currentDate, "yyyy-MM")],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: number; dueDate: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, { dueDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated", description: "Due date has been changed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ reminderId, scheduledAt }: { reminderId: number; scheduledAt: string }) => {
      const res = await apiRequest("PATCH", `/api/reminders/${reminderId}`, { scheduledAt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Reminder updated", description: "Schedule has been changed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update reminder", variant: "destructive" });
    },
  });

  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    calendarData?.tasks?.forEach((task) => {
      if (task.dueDate) {
        allEvents.push({
          id: `task-${task.id}`,
          type: "task",
          title: task.title,
          date: new Date(task.dueDate),
          originalData: task,
          projectId: task.projectId,
          projectName: task.project?.name,
          status: task.status,
        });
      }
    });

    calendarData?.reminders?.forEach((reminder) => {
      if (reminder.scheduledAt) {
        allEvents.push({
          id: `reminder-${reminder.id}`,
          type: "reminder",
          title: reminder.message || `Reminder for: ${reminder.task?.title}`,
          date: new Date(reminder.scheduledAt),
          originalData: reminder,
          projectId: reminder.project?.id,
          projectName: reminder.project?.name,
          status: reminder.status,
        });
      }
    });

    return allEvents;
  }, [calendarData]);

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(event.date, day));
  };

  const getDaysToShow = () => {
    if (viewMode === "month") {
      const start = startOfWeek(startOfMonth(currentDate));
      const end = endOfWeek(endOfMonth(currentDate));
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (event: DragStartEvent) => {
    const eventId = event.active.id as string;
    const calendarEvent = events.find((e) => e.id === eventId);
    setActiveEvent(calendarEvent || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEvent(null);
    const { active, over } = event;

    if (!over) return;

    const eventId = active.id as string;
    const targetDateStr = over.id as string;

    if (!targetDateStr.startsWith("day-")) return;

    const targetDate = parseISO(targetDateStr.replace("day-", ""));
    const calendarEvent = events.find((e) => e.id === eventId);

    if (!calendarEvent || isSameDay(calendarEvent.date, targetDate)) return;

    if (calendarEvent.type === "task") {
      updateTaskMutation.mutate({
        taskId: calendarEvent.originalData.id,
        dueDate: format(targetDate, "yyyy-MM-dd"),
      });
    } else if (calendarEvent.type === "reminder") {
      const originalTime = format(calendarEvent.date, "HH:mm:ss");
      updateReminderMutation.mutate({
        reminderId: calendarEvent.originalData.id,
        scheduledAt: `${format(targetDate, "yyyy-MM-dd")}T${originalTime}`,
      });
    }
  };

  const days = getDaysToShow();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const taskCount = calendarData?.tasks?.filter(t => t.dueDate)?.length || 0;
  const reminderCount = calendarData?.reminders?.length || 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <ClipboardList className="h-3 w-3" />
                {taskCount} tasks
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Bell className="h-3 w-3" />
                {reminderCount} reminders
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="month" data-testid="tab-month">Month</TabsTrigger>
                <TabsTrigger value="week" data-testid="tab-week">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => navigate("prev")} data-testid="button-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigate("next")} data-testid="button-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xl font-semibold mt-2">
          {viewMode === "month"
            ? format(currentDate, "MMMM yyyy")
            : `Week of ${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="border-t">
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className={cn(
              "grid grid-cols-7",
              viewMode === "week" ? "min-h-[400px]" : ""
            )}>
              {days.map((day, index) => (
                <CalendarDay
                  key={day.toISOString()}
                  day={day}
                  events={getEventsForDay(day)}
                  isCurrentMonth={isSameMonth(day, currentDate)}
                  isToday={isToday(day)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeEvent && (
              <CalendarItemCard event={activeEvent} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}
