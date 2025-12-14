import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Calendar,
  ClipboardList,
  MessageSquare,
  Clock,
  Users,
  CheckCircle2,
  Timer,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge, AssociateTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import type { Project, Client, Task, Note, TimeLog, Associate, User } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

type ProjectWithRelations = Project & {
  client: Client;
  tasks: (Task & { associate?: Associate })[];
  notes: (Note & { user: User })[];
  timeLogs: (TimeLog & { user: User })[];
};

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["road", "office"]).default("office"),
  status: z.enum(["pending", "in_progress", "waiting_on_client", "done"]).default("pending"),
  associateId: z.number().optional().nullable(),
  dueDate: z.string().optional(),
});

const noteFormSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

const timeLogFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  taskDescription: z.string().min(1, "Description is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  totalHours: z.string().min(1, "Hours is required"),
  type: z.enum(["road", "office"]).default("office"),
  notes: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;
type NoteFormData = z.infer<typeof noteFormSchema>;
type TimeLogFormData = z.infer<typeof timeLogFormSchema>;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tasks");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const { data: project, isLoading } = useQuery<ProjectWithRelations>({
    queryKey: ["/api/projects", id],
  });

  const { data: associates } = useQuery<Associate[]>({
    queryKey: ["/api/associates"],
  });

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "office",
      status: "pending",
      associateId: null,
      dueDate: "",
    },
  });

  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
    },
  });

  const timeLogForm = useForm<TimeLogFormData>({
    resolver: zodResolver(timeLogFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      taskDescription: "",
      startTime: "",
      endTime: "",
      totalHours: "",
      type: "office",
      notes: "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const payload = {
        ...data,
        projectId: parseInt(id!),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        associateId: data.associateId || null,
      };
      return await apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task created successfully" });
      setIsTaskDialogOpen(false);
      taskForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<TaskFormData> }) => {
      const payload = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        associateId: data.associateId || null,
      };
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task updated successfully" });
      setIsTaskDialogOpen(false);
      setEditingTask(null);
      taskForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task deleted successfully" });
      setDeletingTask(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      const payload = {
        ...data,
        projectId: parseInt(id!),
        userId: user?.id,
      };
      return await apiRequest("POST", "/api/notes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Note added successfully" });
      setIsNoteDialogOpen(false);
      noteForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    },
  });

  const createTimeLogMutation = useMutation({
    mutationFn: async (data: TimeLogFormData) => {
      const payload = {
        ...data,
        projectId: parseInt(id!),
        userId: user?.id,
        date: new Date(data.date),
      };
      return await apiRequest("POST", "/api/time-logs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Time log added successfully" });
      setIsTimeLogDialogOpen(false);
      timeLogForm.reset({ date: format(new Date(), "yyyy-MM-dd"), type: "office" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add time log", variant: "destructive" });
    },
  });

  const handleOpenTaskDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      taskForm.reset({
        title: task.title,
        description: task.description || "",
        type: task.type,
        status: task.status,
        associateId: task.associateId,
        dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingTask(null);
      taskForm.reset();
    }
    setIsTaskDialogOpen(true);
  };

  const onTaskSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTaskMutation.mutate({ taskId: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    updateTaskMutation.mutate({
      taskId: task.id,
      data: { status: newStatus },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
        </Button>
        <DashboardSkeleton />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
        </Button>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="Project not found"
              description="The project you're looking for doesn't exist"
              actionLabel="View All Projects"
              onAction={() => window.location.href = "/projects"}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const tasksByStatus = {
    pending: project.tasks?.filter((t) => t.status === "pending") || [],
    in_progress: project.tasks?.filter((t) => t.status === "in_progress") || [],
    waiting_on_client: project.tasks?.filter((t) => t.status === "waiting_on_client") || [],
    done: project.tasks?.filter((t) => t.status === "done") || [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} type="project" />
          </div>
          <p className="text-muted-foreground mt-1">{project.client?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {project.county && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">County</p>
                <p className="text-sm font-medium">{project.county} County</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.startDate && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">
                  {format(new Date(project.startDate), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.address && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium truncate">{project.address}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {project.description && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <ClipboardList className="h-4 w-4" />
            Tasks ({project.tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4" />
            Notes ({project.notes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="time-logs" className="gap-2" data-testid="tab-time-logs">
            <Clock className="h-4 w-4" />
            Time Logs ({project.timeLogs?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => handleOpenTaskDialog()} data-testid="button-add-task">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingTask ? "Edit Task" : "Add New Task"}</DialogTitle>
                </DialogHeader>
                <Form {...taskForm}>
                  <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                    <FormField
                      control={taskForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="Task title" {...field} data-testid="input-task-title" />
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
                            <Textarea placeholder="Task description" className="resize-none" {...field} data-testid="textarea-task-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={taskForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="office">Office</SelectItem>
                                <SelectItem value="road">Road</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="waiting_on_client">Waiting on Client</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={taskForm.control}
                      name="associateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Associate</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-associate">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Unassigned</SelectItem>
                              {associates?.map((associate) => (
                                <SelectItem key={associate.id} value={associate.id.toString()}>
                                  {associate.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTaskMutation.isPending || updateTaskMutation.isPending} data-testid="button-save-task">
                        {createTaskMutation.isPending || updateTaskMutation.isPending ? "Saving..." : editingTask ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {project.tasks && project.tasks.length > 0 ? (
            <div className="space-y-4">
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                  data-testid={`task-item-${task.id}`}
                >
                  <Checkbox
                    checked={task.status === "done"}
                    onCheckedChange={() => toggleTaskStatus(task)}
                    className="mt-1"
                    data-testid={`checkbox-task-${task.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <TaskTypeBadge type={task.type} />
                      {task.status !== "done" && task.status !== "pending" && (
                        <StatusBadge status={task.status} type="task" />
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {task.associate && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {task.associate.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenTaskDialog(task)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeletingTask(task)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={ClipboardList}
                  title="No tasks yet"
                  description="Add tasks to track work on this project"
                  actionLabel="Add Task"
                  onAction={() => handleOpenTaskDialog()}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Notes</h2>
            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Note</DialogTitle>
                </DialogHeader>
                <Form {...noteForm}>
                  <form onSubmit={noteForm.handleSubmit((data) => createNoteMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={noteForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter your note..." className="min-h-32 resize-none" {...field} data-testid="textarea-note-content" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createNoteMutation.isPending} data-testid="button-save-note">
                        {createNoteMutation.isPending ? "Saving..." : "Add Note"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {project.notes && project.notes.length > 0 ? (
            <div className="space-y-4">
              {project.notes.map((note) => (
                <Card key={note.id} data-testid={`note-item-${note.id}`}>
                  <CardContent className="py-4">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>{note.user?.firstName || note.user?.email || "Unknown"}</span>
                      <span>•</span>
                      <span>{format(new Date(note.createdAt!), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={MessageSquare}
                  title="No notes yet"
                  description="Add notes to keep track of project communications"
                  actionLabel="Add Note"
                  onAction={() => setIsNoteDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="time-logs" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Time Logs</h2>
            <Dialog open={isTimeLogDialogOpen} onOpenChange={setIsTimeLogDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-time-log">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Time</DialogTitle>
                </DialogHeader>
                <Form {...timeLogForm}>
                  <form onSubmit={timeLogForm.handleSubmit((data) => createTimeLogMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={timeLogForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-time-log-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timeLogForm.control}
                      name="taskDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What did you work on?" className="resize-none" {...field} data-testid="textarea-time-log-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={timeLogForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-log-start" />
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
                            <FormLabel>End</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-log-end" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={timeLogForm.control}
                        name="totalHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours *</FormLabel>
                            <FormControl>
                              <Input placeholder="2.5" {...field} data-testid="input-time-log-hours" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={timeLogForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-time-log-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="road">Road</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsTimeLogDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTimeLogMutation.isPending} data-testid="button-save-time-log">
                        {createTimeLogMutation.isPending ? "Saving..." : "Log Time"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {project.timeLogs && project.timeLogs.length > 0 ? (
            <div className="space-y-4">
              {project.timeLogs.map((log) => (
                <Card key={log.id} data-testid={`time-log-item-${log.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.taskDescription}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{format(new Date(log.date), "MMM d, yyyy")}</span>
                          {log.startTime && log.endTime && (
                            <span>{log.startTime} - {log.endTime}</span>
                          )}
                          <span className="font-medium text-foreground">{log.totalHours} hrs</span>
                        </div>
                      </div>
                      <TaskTypeBadge type={log.type} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Clock}
                  title="No time logs yet"
                  description="Log time to track work hours on this project"
                  actionLabel="Log Time"
                  onAction={() => setIsTimeLogDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
