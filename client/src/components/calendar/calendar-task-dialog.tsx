import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  User as UserIcon,
  Bell,
  ClipboardList,
  Save,
  X,
  StickyNote,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { formatLocalDate, parseLocalDate, formatDateForInput } from "@/lib/dateUtils";
import type { Task, Project, User, TimeEntry } from "@shared/schema";
import type { CalendarEvent } from "./calendar-item";

const timeEntryFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  totalMinutes: z.string().min(1, "Duration is required"),
  notes: z.string().optional(),
  isBillable: z.boolean().default(true),
});

type TimeEntryFormData = z.infer<typeof timeEntryFormSchema>;

const taskEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  dueDate: z.string().optional(),
  internalNotes: z.string().optional(),
});

type TaskEditFormData = z.infer<typeof taskEditSchema>;

interface CalendarTaskDialogProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarTaskDialog({ event, isOpen, onClose }: CalendarTaskDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("details");
  const [isEditing, setIsEditing] = useState(false);
  const [notesText, setNotesText] = useState("");

  const task = event?.type === "task" ? event.originalData as Task & { project: Project; assignee?: User } : null;
  const reminder = event?.type === "reminder" ? event.originalData : null;

  const { data: timeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { taskId: task?.id }],
    enabled: !!task?.id,
  });

  const taskTimeEntries = timeEntries?.filter(te => te.taskId === task?.id) || [];

  const taskForm = useForm<TaskEditFormData>({
    resolver: zodResolver(taskEditSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: "",
      internalNotes: "",
    },
  });

  const timeLogForm = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntryFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      totalMinutes: "",
      notes: "",
      isBillable: true,
    },
  });

  useEffect(() => {
    if (task && isOpen) {
      taskForm.reset({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "todo",
        priority: task.priority || "normal",
        dueDate: task.dueDate ? formatDateForInput(task.dueDate) : "",
        internalNotes: task.internalNotes || "",
      });
      setNotesText(task.internalNotes || "");
      setIsEditing(false);
      setActiveTab("details");
    }
  }, [task, isOpen]);

  const watchedStartTime = timeLogForm.watch("startTime");
  const watchedEndTime = timeLogForm.watch("endTime");

  useEffect(() => {
    if (watchedStartTime && watchedEndTime) {
      const [startHour, startMin] = watchedStartTime.split(":").map(Number);
      const [endHour, endMin] = watchedEndTime.split(":").map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      let diff = endMinutes - startMinutes;
      if (diff < 0) diff += 24 * 60;
      
      if (diff > 0) {
        timeLogForm.setValue("totalMinutes", diff.toString());
      }
    }
  }, [watchedStartTime, watchedEndTime, timeLogForm]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await apiRequest("PATCH", `/api/tasks/${task?.id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      const isNotesOnly = Object.keys(variables).length === 1 && "internalNotes" in variables;
      toast({ title: isNotesOnly ? "Notes saved successfully" : "Task updated successfully" });
      setIsEditing(false);
    },
    onError: (_error, variables) => {
      const isNotesOnly = Object.keys(variables).length === 1 && "internalNotes" in variables;
      toast({ title: "Error", description: isNotesOnly ? "Failed to save notes" : "Failed to update task", variant: "destructive" });
    },
  });

  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: TimeEntryFormData & { taskId: number; projectId: number }) => {
      const payload = {
        taskId: data.taskId,
        projectId: data.projectId,
        userId: user?.id,
        date: parseLocalDate(data.date),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        totalMinutes: parseInt(data.totalMinutes),
        notes: data.notes || null,
        isBillable: data.isBillable,
      };
      return await apiRequest("POST", "/api/time-entries", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({ title: "Time entry logged successfully" });
      timeLogForm.reset({ date: format(new Date(), "yyyy-MM-dd"), isBillable: true });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log time entry", variant: "destructive" });
    },
  });

  const toggleTaskStatus = () => {
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTaskMutation.mutate({ status: newStatus });
  };

  const onSubmitTaskEdit = (data: TaskEditFormData) => {
    if (!task) return;
    updateTaskMutation.mutate({
      title: data.title,
      description: data.description || null,
      status: data.status as "todo" | "in_progress" | "waiting" | "done",
      priority: data.priority as "low" | "normal" | "high" | "urgent",
      dueDate: data.dueDate ? parseLocalDate(data.dueDate) : null,
      internalNotes: notesText || null,
    });
  };

  const saveNotesDirectly = () => {
    if (!task) return;
    updateTaskMutation.mutate({ internalNotes: notesText || null });
  };

  const onSubmitTimeEntry = (data: TimeEntryFormData) => {
    if (!task) return;
    createTimeEntryMutation.mutate({
      ...data,
      taskId: task.id,
      projectId: task.projectId,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (!event) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {event.type === "task" && <ClipboardList className="h-5 w-5 text-chart-4" />}
            {event.type === "reminder" && <Bell className="h-5 w-5 text-chart-3" />}
            <DialogTitle className="text-xl" data-testid="text-dialog-title">
              {event.type === "task" ? "Task Details" : "Reminder Details"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {event.type === "task" && task && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="gap-2" data-testid="tab-details">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2" data-testid="tab-notes">
                <StickyNote className="h-4 w-4" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="timelog" className="gap-2" data-testid="tab-timelog">
                <Clock className="h-4 w-4" />
                Time Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 pt-4">
              {isEditing ? (
                <Form {...taskForm}>
                  <form onSubmit={taskForm.handleSubmit(onSubmitTaskEdit)} className="space-y-4">
                    <FormField
                      control={taskForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-task-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={taskForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} data-testid="input-task-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={taskForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="waiting">Waiting</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={taskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={taskForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-task-due-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={updateTaskMutation.isPending} data-testid="button-save-task">
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-task-title">{task.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline">{task.type?.replace(/_/g, ' ') || 'task'}</Badge>
                      <Badge
                        variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'}
                      >
                        {task.priority || 'normal'}
                      </Badge>
                      <StatusBadge status={task.status} type="task" />
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {task.locationType || 'office'}
                      </Badge>
                    </div>
                  </div>

                  {task.description && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Description
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Project
                      </h4>
                      <Link
                        href={`/projects/${task.project?.id}`}
                        className="text-sm text-primary hover:underline"
                        data-testid={`link-task-project-${task.projectId}`}
                      >
                        P-{task.project?.id}: {task.project?.name}
                      </Link>
                    </div>

                    {task.assignee && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          Assignee
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {task.assignee.firstName} {task.assignee.lastName || ''}
                        </p>
                      </div>
                    )}

                    {task.dueDate && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Due Date
                        </h4>
                        <p className="text-sm text-muted-foreground">{formatLocalDate(task.dueDate)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
                    <Button
                      variant={task.status === "done" ? "outline" : "default"}
                      onClick={toggleTaskStatus}
                      data-testid="button-toggle-task-status"
                    >
                      <Checkbox
                        checked={task.status === "done"}
                        className="mr-2"
                        onCheckedChange={() => {}}
                      />
                      {task.status === "done" ? "Mark Incomplete" : "Mark Complete"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      data-testid="button-edit-task"
                    >
                      Edit Task
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/projects/${task.projectId}`} data-testid="link-view-project">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Project
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Internal Notes</label>
                  <Textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Add internal notes about this task..."
                    className="min-h-[200px]"
                    data-testid="input-internal-notes"
                  />
                </div>
                <Button onClick={saveNotesDirectly} disabled={updateTaskMutation.isPending} data-testid="button-save-notes">
                  <Save className="h-4 w-4 mr-2" />
                  Save Notes
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="timelog" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Log Time</h4>
                <Form {...timeLogForm}>
                  <form onSubmit={timeLogForm.handleSubmit(onSubmitTimeEntry)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={timeLogForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-time-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={timeLogForm.control}
                        name="totalMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration (minutes)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} data-testid="input-time-duration" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={timeLogForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time (optional)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-start" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={timeLogForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time (optional)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-end" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={timeLogForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="What did you work on?" data-testid="input-time-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={timeLogForm.control}
                      name="isBillable"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-billable"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Billable</FormLabel>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={createTimeEntryMutation.isPending} data-testid="button-log-time">
                      <Clock className="h-4 w-4 mr-2" />
                      Log Time
                    </Button>
                  </form>
                </Form>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Time Entries for this Task</h4>
                {taskTimeEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time entries yet.</p>
                ) : (
                  <div className="space-y-2">
                    {taskTimeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`time-entry-${entry.id}`}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {entry.date ? formatLocalDate(entry.date) : "-"}
                            {entry.startTime && entry.endTime && (
                              <span className="text-muted-foreground ml-2">
                                {entry.startTime} - {entry.endTime}
                              </span>
                            )}
                          </p>
                          {entry.notes && (
                            <p className="text-sm text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.isBillable ? "default" : "secondary"}>
                            {formatDuration(entry.totalMinutes)}
                          </Badge>
                          {entry.isBillable && (
                            <Badge variant="outline">Billable</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {event.type === "reminder" && reminder && (
          <div className="space-y-6 pt-4">
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-reminder-title">{reminder.message || "Reminder"}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline">{reminder.status}</Badge>
                {reminder.isRead && (
                  <Badge variant="secondary">Read</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reminder.scheduledAt && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Scheduled
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(reminder.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}

              {reminder.task && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Related Task
                  </h4>
                  <p className="text-sm text-muted-foreground">{reminder.task.title}</p>
                </div>
              )}

              {reminder.project && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Project
                  </h4>
                  <Link
                    href={`/projects/${reminder.project.id}`}
                    className="text-sm text-primary hover:underline"
                    data-testid={`link-reminder-project-${reminder.project.id}`}
                  >
                    P-{reminder.project.id}: {reminder.project.name}
                  </Link>
                </div>
              )}
            </div>

            {reminder.actionNote && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Action Note</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{reminder.actionNote}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
              {reminder.project && (
                <Button variant="outline" asChild>
                  <Link href={`/projects/${reminder.project.id}`} data-testid="link-view-reminder-project">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Project
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
