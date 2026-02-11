import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Timer,
  AlertCircle,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Task, Project } from "@shared/schema";
import { formatLocalDate } from "@/lib/dateUtils";
import { isPast } from "date-fns";

type TaskWithProject = Task & { project: Project };

const TASK_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

export default function ClientTasks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tasks, isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/client/tasks"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

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

  const isOverdue = (task: TaskWithProject) => {
    if (!task.dueDate || task.status === "done" || task.status === "cancelled") return false;
    const dueDate = new Date(task.dueDate);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return dueDate < todayStart;
  };

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
      </div>

      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={isOverdue(task) ? "border-destructive/50" : ""}
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
                      {task.type && <TaskTypeBadge type={task.type} />}
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
                        <Link href={`/projects/${task.projectId}`} className="hover:text-foreground">
                          Project: {task.project.name}
                        </Link>
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
              description={searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Tasks will appear here as they are created for your projects"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
