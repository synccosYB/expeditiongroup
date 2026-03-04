import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Timer,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  ExternalLink,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Task, Project, TimeEntry } from "@shared/schema";
import { formatLocalDate } from "@/lib/dateUtils";

type TaskWithProject = Task & { project: Project };

const TASK_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "overdue", label: "Due & Overdue" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function ClientTaskDetailDialog({
  task,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  currentIndex,
  totalCount,
}: {
  task: TaskWithProject | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
}) {
  const [activeTab, setActiveTab] = useState("details");

  const { data: timeEntries } = useQuery<(TimeEntry & { project: Project; task: Task })[]>({
    queryKey: ["/api/client/time-entries"],
    enabled: isOpen,
  });

  const taskTimeEntries = timeEntries?.filter(te => te.taskId === task?.id) || [];

  useEffect(() => {
    if (task && isOpen) {
      setActiveTab("details");
    }
  }, [task?.id, isOpen]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-chart-4" />
              <DialogTitle className="text-xl" data-testid="text-client-task-detail-title">Task Details</DialogTitle>
            </div>
            <DialogDescription className="sr-only">View task details</DialogDescription>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground" data-testid="text-client-task-position">
              Task {currentIndex + 1} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onPrevious}
                disabled={!hasPrevious}
                data-testid="button-client-previous-task"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                disabled={!hasNext}
                data-testid="button-client-next-task"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="gap-2" data-testid="tab-client-task-details">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2" data-testid="tab-client-task-notes">
              <StickyNote className="h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="timelog" className="gap-2" data-testid="tab-client-task-timelog">
              <Clock className="h-4 w-4" />
              Time Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 pt-4">
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-client-task-title">{task.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline">{task.type?.replace(/_/g, ' ') || 'task'}</Badge>
                <Badge
                  variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'}
                >
                  {task.priority || 'normal'}
                </Badge>
                <StatusBadge status={task.status} type="task" />
                {task.locationType && (
                  <Badge variant="outline">
                    <MapPin className="h-3 w-3 mr-1" />
                    {task.locationType}
                  </Badge>
                )}
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
                  data-testid={`link-client-task-project-${task.projectId}`}
                >
                  P-{task.project?.id}: {task.project?.name}
                </Link>
              </div>

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
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${task.projectId}`} data-testid="link-client-view-project-from-task">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Project
                </Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Notes</label>
              {task.internalNotes ? (
                <div className="p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap" data-testid="text-client-task-notes">
                  {task.internalNotes}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-client-no-notes">No notes for this task.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="timelog" className="space-y-6 pt-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Time Entries for this Task</h4>
              {taskTimeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-client-no-time-entries">No time entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {taskTimeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`client-task-time-entry-${entry.id}`}
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
                  <Separator className="my-2" />
                  <div className="flex justify-end text-sm font-medium">
                    Total: {formatDuration(taskTimeEntries.reduce((sum, e) => sum + e.totalMinutes, 0))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientTasks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);

  const { data: tasks, isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/client/tasks"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const isOverdue = (task: TaskWithProject) => {
    if (!task.dueDate || task.status === "done" || task.status === "cancelled") return false;
    const dueDate = new Date(task.dueDate);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return dueDate < todayStart;
  };

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "overdue" ? isOverdue(task) : task.status === statusFilter);
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  const todoCount = tasks?.filter(t => t.status === "todo").length ?? 0;
  const inProgressCount = tasks?.filter(t => t.status === "in_progress").length ?? 0;
  const waitingCount = tasks?.filter(t => (t.status as string) === "waiting").length ?? 0;
  const doneCount = tasks?.filter(t => t.status === "done").length ?? 0;
  const overdueCount = tasks?.filter(t => isOverdue(t)).length ?? 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-chart-2" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-chart-4" />;
      case "waiting":
        return <AlertCircle className="h-4 w-4 text-chart-3" />;
      default:
        return <Timer className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const selectedTask = selectedTaskIndex !== null ? filteredTasks[selectedTaskIndex] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-tasks-title">
          Tasks
        </h1>
        <p className="text-muted-foreground mt-1">
          View tasks across all your projects
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("todo")} data-testid="stat-tasks-todo">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{todoCount}</div>
            <div className="text-xs text-muted-foreground">To Do</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("in_progress")} data-testid="stat-tasks-in-progress">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-chart-4">{inProgressCount}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("waiting")} data-testid="stat-tasks-waiting">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-chart-3">{waitingCount}</div>
            <div className="text-xs text-muted-foreground">Waiting</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("done")} data-testid="stat-tasks-done">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-chart-2">{doneCount}</div>
            <div className="text-xs text-muted-foreground">Done</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover-elevate ${overdueCount > 0 ? "border-destructive/50" : ""}`} onClick={() => setStatusFilter("overdue")} data-testid="stat-tasks-overdue">
          <CardContent className="p-3 text-center">
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>{overdueCount}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-priority-filter">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority.value} value={priority.value}>
                {priority.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task, index) => (
            <Card
              key={task.id}
              className={`cursor-pointer hover-elevate ${isOverdue(task) ? "border-destructive/50" : ""}`}
              onClick={() => setSelectedTaskIndex(index)}
              data-testid={`card-task-${task.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </span>
                      <StatusBadge status={task.status} type="task" />
                      {(task.type === "road" || task.type === "office") && <TaskTypeBadge type={task.type} />}
                      {task.priority === "urgent" && <Badge variant="destructive">Urgent</Badge>}
                      {task.priority === "high" && <Badge variant="default">High</Badge>}
                      {isOverdue(task) && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {task.project && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {task.project.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {formatLocalDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="No tasks found"
              description={searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Tasks will appear here as they are created for your projects"}
            />
          </CardContent>
        </Card>
      )}

      <ClientTaskDetailDialog
        task={selectedTask}
        isOpen={selectedTaskIndex !== null}
        onClose={() => setSelectedTaskIndex(null)}
        onPrevious={() => setSelectedTaskIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)}
        onNext={() => setSelectedTaskIndex(prev => prev !== null && prev < filteredTasks.length - 1 ? prev + 1 : prev)}
        hasPrevious={selectedTaskIndex !== null && selectedTaskIndex > 0}
        hasNext={selectedTaskIndex !== null && selectedTaskIndex < filteredTasks.length - 1}
        currentIndex={selectedTaskIndex ?? 0}
        totalCount={filteredTasks.length}
      />
    </div>
  );
}
