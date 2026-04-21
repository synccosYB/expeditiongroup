import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { format, addMonths, subMonths, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addWeeks, subWeeks, startOfWeek, endOfWeek, parse, setMonth, setYear, getMonth, getYear } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bell, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarDay } from "./calendar-day";
import { CalendarItem, CalendarItemCard } from "./calendar-item";
import { CalendarTaskDialog } from "./calendar-task-dialog";
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

type ViewMode = "month" | "week" | "day";

function toLocalDate(dateValue: string | Date): Date {
  if (!dateValue) return new Date();
  if (typeof dateValue === 'string') {
    const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    }
  }
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
}

export function CalendarView() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  const calendarCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const dayCollisions = pointerCollisions.filter(c => String(c.id).startsWith("day-"));
      if (dayCollisions.length > 0) return dayCollisions;
      return pointerCollisions;
    }
    const rectCollisions = rectIntersection(args);
    const dayRectCollisions = rectCollisions.filter(c => String(c.id).startsWith("day-"));
    if (dayRectCollisions.length > 0) return dayRectCollisions;
    return rectCollisions;
  };

  const { data: calendarData, isLoading } = useQuery<{
    tasks: (Task & { project: Project })[];
    reminders: (TaskReminder & { task: Task; project: Project })[];
  }>({
    queryKey: ["/api/calendar/events", format(currentDate, "yyyy-MM")],
  });

  const [lastDropDate, setLastDropDate] = useState<string>("");

  type CalendarEventsData = {
    tasks: (Task & { project: Project })[];
    reminders: (TaskReminder & { task: Task; project: Project })[];
  };
  type TasksCacheData =
    | (Task & { project?: Project })
    | (Task & { project?: Project })[]
    | undefined;
  type RemindersCacheData = TaskReminder | TaskReminder[] | undefined;
  type CacheSnapshot<TData> = ReturnType<typeof queryClient.getQueriesData<TData>>;

  const restoreSnapshots = <TData,>(snapshots: CacheSnapshot<TData>) => {
    snapshots.forEach(([key, data]) => queryClient.setQueryData<TData>(key, data));
  };

  const updateTaskMutation = useMutation<
    unknown,
    Error,
    { taskId: number; dueDate: string },
    {
      prevCalendar: CacheSnapshot<CalendarEventsData>;
      prevTasks: CacheSnapshot<TasksCacheData>;
    }
  >({
    mutationFn: async ({ taskId, dueDate }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, { dueDate });
      return res.json();
    },
    onMutate: async ({ taskId, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/calendar/events"] });
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });

      const prevCalendar = queryClient.getQueriesData<CalendarEventsData>({
        queryKey: ["/api/calendar/events"],
      });
      const prevTasks = queryClient.getQueriesData<TasksCacheData>({
        queryKey: ["/api/tasks"],
      });

      queryClient.setQueriesData<CalendarEventsData>(
        { queryKey: ["/api/calendar/events"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) =>
              t.id === taskId ? { ...t, dueDate: new Date(dueDate) } : t
            ),
            reminders: old.reminders.map((r) =>
              r.task?.id === taskId
                ? { ...r, task: { ...r.task, dueDate: new Date(dueDate) } }
                : r
            ),
          };
        }
      );

      queryClient.setQueriesData<TasksCacheData>(
        { queryKey: ["/api/tasks"] },
        (old) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((t) =>
              t?.id === taskId ? { ...t, dueDate: new Date(dueDate) } : t
            );
          }
          if (old.id === taskId) return { ...old, dueDate: new Date(dueDate) };
          return old;
        }
      );

      return { prevCalendar, prevTasks };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        restoreSnapshots(ctx.prevCalendar);
        restoreSnapshots(ctx.prevTasks);
      }
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Task moved", description: `Due date changed to ${lastDropDate}` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const updateReminderMutation = useMutation<
    unknown,
    Error,
    { reminderId: number; scheduledAt: string },
    {
      prevCalendar: CacheSnapshot<CalendarEventsData>;
      prevReminders: CacheSnapshot<RemindersCacheData>;
    }
  >({
    mutationFn: async ({ reminderId, scheduledAt }) => {
      const res = await apiRequest("PATCH", `/api/reminders/${reminderId}`, { scheduledAt });
      return res.json();
    },
    onMutate: async ({ reminderId, scheduledAt }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/calendar/events"] });
      await queryClient.cancelQueries({ queryKey: ["/api/reminders"] });

      const prevCalendar = queryClient.getQueriesData<CalendarEventsData>({
        queryKey: ["/api/calendar/events"],
      });
      const prevReminders = queryClient.getQueriesData<RemindersCacheData>({
        queryKey: ["/api/reminders"],
      });

      queryClient.setQueriesData<CalendarEventsData>(
        { queryKey: ["/api/calendar/events"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            reminders: old.reminders.map((r) =>
              r.id === reminderId ? { ...r, scheduledAt: new Date(scheduledAt) } : r
            ),
          };
        }
      );

      queryClient.setQueriesData<RemindersCacheData>(
        { queryKey: ["/api/reminders"] },
        (old) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((r) =>
              r?.id === reminderId ? { ...r, scheduledAt: new Date(scheduledAt) } : r
            );
          }
          if (old.id === reminderId) return { ...old, scheduledAt: new Date(scheduledAt) };
          return old;
        }
      );

      return { prevCalendar, prevReminders };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        restoreSnapshots(ctx.prevCalendar);
        restoreSnapshots(ctx.prevReminders);
      }
      toast({ title: "Error", description: "Failed to update reminder", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Reminder updated", description: "Schedule has been changed" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
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
          date: toLocalDate(task.dueDate),
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
          date: toLocalDate(reminder.scheduledAt),
          originalData: { ...reminder, _originalScheduledAt: reminder.scheduledAt },
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
    } else if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setViewMode("day");
  };

  const handleMonthChange = (month: string) => {
    setCurrentDate(setMonth(currentDate, parseInt(month)));
  };

  const handleYearChange = (year: string) => {
    setCurrentDate(setYear(currentDate, parseInt(year)));
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
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

    // Parse date string in local time to avoid timezone shifts
    const dateStr = targetDateStr.replace("day-", "");
    const targetDate = parse(dateStr, "yyyy-MM-dd", new Date());
    const calendarEvent = events.find((e) => e.id === eventId);

    if (!calendarEvent || isSameDay(calendarEvent.date, targetDate)) return;

    const formattedDate = format(targetDate, "yyyy-MM-dd");
    const displayDate = format(targetDate, "MMM d, yyyy");
    setLastDropDate(displayDate);
    if (calendarEvent.type === "task") {
      updateTaskMutation.mutate({
        taskId: calendarEvent.originalData.id,
        dueDate: `${formattedDate}T12:00:00`,
      });
    } else if (calendarEvent.type === "reminder") {
      const origScheduled = new Date(calendarEvent.originalData._originalScheduledAt || calendarEvent.originalData.scheduledAt);
      const originalTime = format(origScheduled, "HH:mm:ss");
      updateReminderMutation.mutate({
        reminderId: calendarEvent.originalData.id,
        scheduledAt: `${formattedDate}T${originalTime}`,
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
                <TabsTrigger value="day" data-testid="tab-day">Day</TabsTrigger>
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
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {viewMode === "month" ? (
            <>
              <Select value={String(getMonth(currentDate))} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[140px]" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={month} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(getYear(currentDate))} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[100px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : viewMode === "week" ? (
            <p className="text-xl font-semibold">
              Week of {format(startOfWeek(currentDate), "MMM d")} - {format(endOfWeek(currentDate), "MMM d, yyyy")}
            </p>
          ) : (
            <p className="text-xl font-semibold">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <DndContext
          sensors={sensors}
          collisionDetection={calendarCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="border-t">
            {viewMode === "day" ? (
              <div className="p-4 min-h-[400px]">
                {(() => {
                  const todayEvents = getEventsForDay(currentDate);
                  if (todayEvents.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <CalendarIcon className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-lg font-medium">No tasks or reminders</p>
                        <p className="text-sm">Nothing scheduled for {format(currentDate, "MMMM d, yyyy")}</p>
                      </div>
                    );
                  }
                  const taskEvents = todayEvents.filter(e => e.type === "task");
                  const reminderEvents = todayEvents.filter(e => e.type === "reminder");
                  return (
                    <div className="space-y-4">
                      {taskEvents.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Tasks ({taskEvents.length})
                          </h4>
                          <div className="space-y-1">
                            {taskEvents.map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                                  event.status === "done" && "opacity-50"
                                )}
                                onClick={() => handleEventClick(event)}
                                data-testid={`day-view-item-${event.id}`}
                              >
                                <ClipboardList className="h-4 w-4 text-chart-4 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium truncate", event.status === "done" && "line-through")}>
                                    {event.title}
                                  </p>
                                  {event.projectName && (
                                    <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
                                  )}
                                </div>
                                {event.status && (
                                  <Badge variant={event.status === "done" ? "secondary" : "outline"} className="text-xs flex-shrink-0">
                                    {event.status.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {reminderEvents.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            Reminders ({reminderEvents.length})
                          </h4>
                          <div className="space-y-1">
                            {reminderEvents.map((event) => (
                              <div
                                key={event.id}
                                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => handleEventClick(event)}
                                data-testid={`day-view-item-${event.id}`}
                              >
                                <Bell className="h-4 w-4 text-chart-3 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{event.title}</p>
                                  {event.projectName && (
                                    <p className="text-xs text-muted-foreground truncate">{event.projectName}</p>
                                  )}
                                </div>
                                {event.status && (
                                  <Badge variant="outline" className="text-xs flex-shrink-0">
                                    {event.status}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
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
                      onEventClick={handleEventClick}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <DragOverlay>
            {activeEvent && (
              <CalendarItemCard event={activeEvent} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>

      <CalendarTaskDialog
        event={selectedEvent}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
      />
    </Card>
  );
}
