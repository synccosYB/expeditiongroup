import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Search,
  ClipboardList,
  Calendar,
  Users,
  ExternalLink,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Task, Project } from "@shared/schema";
import { format } from "date-fns";

type TaskWithProject = Task & { project: Project };

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_client", label: "Waiting on Client" },
  { value: "done", label: "Done" },
];

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "road", label: "Road" },
  { value: "office", label: "Office" },
];

export default function Tasks() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: tasks, isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/tasks"],
  });

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

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    updateTaskMutation.mutate({ taskId: task.id, status: newStatus });
  };

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesType = typeFilter === "all" || task.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

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
        <h1 className="text-3xl font-semibold text-foreground">Tasks</h1>
        <p className="text-muted-foreground mt-1">View all tasks across projects</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
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
          <SelectTrigger className="w-full sm:w-44" data-testid="select-task-status-filter">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-task-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTasks && filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
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
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <Link href={`/projects/${task.project?.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {task.project?.name}
                      </Link>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
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
              description={searchQuery || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Tasks will appear here when you add them to projects"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
