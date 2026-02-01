import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ClipboardList,
  Calendar,
  Users,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  MoreHorizontal,
  MapPin,
  FileText,
  User as UserIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { parseLocalDate, parseLocalDateFromISO, formatLocalDate, isDateOverdue } from "@/lib/dateUtils";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import type { Task, Project, User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type TaskWithProject = Task & { project: Project; assignee?: User };
type TaskWithSubtasks = TaskWithProject & { subtasks?: TaskWithSubtasks[] };

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const locationOptions = [
  { value: "all", label: "All Locations" },
  { value: "office", label: "Office" },
  { value: "road", label: "Road" },
];

const timeEntryFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  totalMinutes: z.string().min(1, "Duration is required"),
  notes: z.string().optional(),
  isBillable: z.boolean().default(true),
});

type TimeEntryFormData = z.infer<typeof timeEntryFormSchema>;

function flattenTasks(tasks: TaskWithSubtasks[]): TaskWithSubtasks[] {
  const result: TaskWithSubtasks[] = [];
  function traverse(task: TaskWithSubtasks) {
    result.push(task);
    if (task.subtasks) {
      task.subtasks.forEach(traverse);
    }
  }
  tasks.forEach(traverse);
  return result;
}

function TaskDetailDialog({
  task,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  currentIndex,
  totalCount,
  onToggle,
  onLogTime,
}: {
  task: TaskWithSubtasks | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  onToggle: (task: Task) => void;
  onLogTime: (task: Task) => void;
}) {
  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl flex-1 pr-4">{task.title}</DialogTitle>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground" data-testid="text-task-position">
              Task {currentIndex + 1} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onPrevious}
                disabled={!hasPrevious}
                data-testid="button-previous-task"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                disabled={!hasNext}
                data-testid="button-next-task"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex flex-wrap items-center gap-2">
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
                data-testid={`link-task-detail-project-${task.projectId}`}
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

            {task.subtasks && task.subtasks.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Subtasks</h4>
                <p className="text-sm text-muted-foreground">
                  {task.subtasks.filter(s => s.status === 'done').length} of {task.subtasks.length} completed
                </p>
              </div>
            )}
          </div>

          {task.internalNotes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Internal Notes</h4>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                {task.internalNotes}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
            <Button
              variant={task.status === "done" ? "outline" : "default"}
              onClick={() => onToggle(task)}
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
              onClick={() => onLogTime(task)}
              data-testid="button-log-time-detail"
            >
              <Clock className="h-4 w-4 mr-2" />
              Log Time
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/projects/${task.projectId}`} data-testid="link-view-project-detail">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Project
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildTaskHierarchy(tasks: TaskWithProject[]): TaskWithSubtasks[] {
  const taskMap = new Map<number, TaskWithSubtasks>();
  const rootTasks: TaskWithSubtasks[] = [];
  
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, subtasks: [] });
  });
  
  tasks.forEach(task => {
    const taskWithSubtasks = taskMap.get(task.id)!;
    if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
      const parent = taskMap.get(task.parentTaskId)!;
      parent.subtasks!.push(taskWithSubtasks);
    } else if (!task.parentTaskId) {
      rootTasks.push(taskWithSubtasks);
    }
  });
  
  return rootTasks;
}

function TaskHierarchyItem({ 
  task, 
  level = 0, 
  onToggle,
  onLogTime,
  onOpenDetail,
  expandedTasks,
  toggleExpand,
}: { 
  task: TaskWithSubtasks; 
  level?: number;
  onToggle: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onOpenDetail: (task: TaskWithSubtasks) => void;
  expandedTasks: Set<number>;
  toggleExpand: (taskId: number) => void;
}) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);

  return (
    <div className="space-y-2">
      <Card 
        className={`hover-elevate ${level > 0 ? 'ml-6 border-l-2 border-l-muted' : ''}`}
        data-testid={`card-task-${task.id}`}
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              {hasSubtasks && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => toggleExpand(task.id)}
                  data-testid={`button-expand-task-${task.id}`}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              )}
              <Checkbox
                checked={task.status === "done"}
                onCheckedChange={() => onToggle(task)}
                className="mt-1"
                data-testid={`checkbox-task-${task.id}`}
              />
            </div>
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onOpenDetail(task)}
              data-testid={`button-open-task-${task.id}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-medium hover:text-primary transition-colors ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                <Badge variant="outline">{task.type?.replace(/_/g, ' ') || 'task'}</Badge>
                <Badge 
                  variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'}
                >
                  {task.priority || 'normal'}
                </Badge>
                {task.status !== "done" && task.status !== "todo" && (
                  <StatusBadge status={task.status} type="task" />
                )}
                {hasSubtasks && (
                  <Badge variant="outline">
                    {task.subtasks?.filter(s => s.status === 'done').length}/{task.subtasks?.length} subtasks
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <Link 
                  href={`/projects/${task.project?.id}`} 
                  className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors"
                  data-testid={`link-project-${task.projectId}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  P-{task.project?.id}: {task.project?.name}
                </Link>
                {task.assignee && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {task.assignee.firstName || task.assignee.email}
                  </span>
                )}
                {task.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatLocalDate(task.dueDate)}
                  </span>
                )}
                <Badge variant="outline">{task.locationType || 'office'}</Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-task-menu-${task.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onLogTime(task)}>
                  <Clock className="h-4 w-4 mr-2" />
                  Log Time
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${task.projectId}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Project
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      {hasSubtasks && isExpanded && (
        <div className="space-y-2">
          {task.subtasks?.map((subtask) => (
            <TaskHierarchyItem
              key={subtask.id}
              task={subtask}
              level={level + 1}
              onToggle={onToggle}
              onLogTime={onLogTime}
              onOpenDetail={onOpenDetail}
              expandedTasks={expandedTasks}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialStatusFilter = searchParams.get("filter") || "all";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false);
  const [selectedTaskForTimeLog, setSelectedTaskForTimeLog] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);

  const { data: tasks, isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/tasks"],
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
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({ title: "Time entry logged successfully" });
      setIsTimeLogDialogOpen(false);
      setSelectedTaskForTimeLog(null);
      timeLogForm.reset({ date: format(new Date(), "yyyy-MM-dd"), isBillable: true });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to log time entry", variant: "destructive" });
    },
  });

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTaskMutation.mutate({ taskId: task.id, status: newStatus });
  };

  const handleLogTime = (task: Task) => {
    setSelectedTaskForTimeLog(task);
    setIsTimeLogDialogOpen(true);
  };

  const onSubmitTimeEntry = (data: TimeEntryFormData) => {
    if (!selectedTaskForTimeLog) return;
    createTimeEntryMutation.mutate({
      ...data,
      taskId: selectedTaskForTimeLog.id,
      projectId: selectedTaskForTimeLog.projectId,
    });
  };

  const toggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const filteredTasks = tasks?.filter(Boolean).filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusFilter === "overdue") {
      matchesStatus = isDateOverdue(task.dueDate) && task.status !== "done" && task.status !== "cancelled";
    } else {
      matchesStatus = task.status === statusFilter;
    }
    
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesLocation = locationFilter === "all" || task.locationType === locationFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesLocation;
  });

  const taskHierarchy = filteredTasks ? buildTaskHierarchy(filteredTasks) : [];
  const flatTaskList = flattenTasks(taskHierarchy);

  const handleOpenTaskDetail = (task: TaskWithSubtasks) => {
    const index = flatTaskList.findIndex(t => t.id === task.id);
    if (index !== -1) {
      setSelectedTaskIndex(index);
      setIsTaskDetailOpen(true);
    }
  };

  const handlePreviousTask = () => {
    if (selectedTaskIndex > 0) {
      setSelectedTaskIndex(selectedTaskIndex - 1);
    }
  };

  const handleNextTask = () => {
    if (selectedTaskIndex < flatTaskList.length - 1) {
      setSelectedTaskIndex(selectedTaskIndex + 1);
    }
  };

  const selectedTask = flatTaskList[selectedTaskIndex] || null;

  useEffect(() => {
    if (isTaskDetailOpen && flatTaskList.length === 0) {
      setIsTaskDetailOpen(false);
    } else if (isTaskDetailOpen && selectedTaskIndex >= flatTaskList.length) {
      setSelectedTaskIndex(Math.max(0, flatTaskList.length - 1));
    }
  }, [flatTaskList.length, isTaskDetailOpen, selectedTaskIndex]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1">View all tasks across projects</p>
          </div>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">Tasks</h1>
        <p className="text-muted-foreground mt-1">View all tasks across projects</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-task-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-task-priority-filter">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-task-location-filter">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            {locationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span data-testid="text-task-count">{filteredTasks?.length} tasks</span>
          <span>{filteredTasks?.filter(t => t.status === 'done').length} completed</span>
        </div>
      )}

      {taskHierarchy.length > 0 ? (
        <div className="space-y-3">
          {taskHierarchy.map((task) => (
            <TaskHierarchyItem
              key={task.id}
              task={task}
              onToggle={toggleTaskStatus}
              onLogTime={handleLogTime}
              onOpenDetail={handleOpenTaskDetail}
              expandedTasks={expandedTasks}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="No tasks found"
              description={searchQuery || statusFilter !== "all" || priorityFilter !== "all" || locationFilter !== "all"
                ? "Try adjusting your filters"
                : "Tasks will appear here when you add them to projects"}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={isTimeLogDialogOpen} onOpenChange={setIsTimeLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time for Task</DialogTitle>
          </DialogHeader>
          {selectedTaskForTimeLog && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm">{selectedTaskForTimeLog.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Project: {(selectedTaskForTimeLog as TaskWithProject).project?.name}
              </p>
            </div>
          )}
          <Form {...timeLogForm}>
            <form onSubmit={timeLogForm.handleSubmit(onSubmitTimeEntry)} className="space-y-4">
              <FormField
                control={timeLogForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-time-entry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={timeLogForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time (optional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-time-entry-start" />
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
                        <Input type="time" {...field} data-testid="input-time-entry-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={timeLogForm.control}
                name="totalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 60 for 1 hour" 
                        {...field} 
                        data-testid="input-time-entry-duration" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={timeLogForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="What did you work on?" 
                        {...field} 
                        data-testid="input-time-entry-notes" 
                      />
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
                        data-testid="checkbox-time-entry-billable"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Billable</FormLabel>
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={createTimeEntryMutation.isPending}
                data-testid="button-submit-time-entry"
              >
                {createTimeEntryMutation.isPending ? "Logging..." : "Log Time"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={selectedTask}
        isOpen={isTaskDetailOpen}
        onClose={() => setIsTaskDetailOpen(false)}
        onPrevious={handlePreviousTask}
        onNext={handleNextTask}
        hasPrevious={selectedTaskIndex > 0}
        hasNext={selectedTaskIndex < flatTaskList.length - 1}
        currentIndex={selectedTaskIndex}
        totalCount={flatTaskList.length}
        onToggle={toggleTaskStatus}
        onLogTime={handleLogTime}
      />
    </div>
  );
}
