import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  FolderKanban,
  ClipboardList,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Timer,
  AlertTriangle,
  Calendar,
  DollarSign,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { Project, Task, Invoice } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface ClientDashboardStats {
  totalProjects: number;
  activeProjects: number;
  pendingTasks: number;
  completedTasks: number;
  totalInvoices: number;
  unpaidInvoices: number;
  totalOutstanding: number;
}

interface ProjectsByStatus {
  status: string;
  count: number;
}

const STATUS_PIPELINE_ORDER = [
  { key: "intake", label: "Intake", color: "bg-slate-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "waiting_on_client", label: "Waiting on Client", color: "bg-amber-500" },
  { key: "with_dob", label: "With DOB", color: "bg-purple-500" },
  { key: "on_hold", label: "On Hold", color: "bg-gray-500" },
  { key: "completed", label: "Completed", color: "bg-green-500" },
] as const;

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<ClientDashboardStats>({
    queryKey: ["/api/client/dashboard/stats"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/client/projects"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<(Task & { project: Project })[]>({
    queryKey: ["/api/client/tasks"],
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/client/invoices"],
  });

  const { data: projectsByStatus, isLoading: pipelineLoading } = useQuery<ProjectsByStatus[]>({
    queryKey: ["/api/client/projects/by-status"],
  });

  const isLoading = statsLoading || projectsLoading || tasksLoading || invoicesLoading || pipelineLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const recentProjects = projects?.slice(0, 5) || [];
  const pendingTasks = tasks?.filter(t => t.status !== "done").slice(0, 5) || [];
  const overdueTasks = tasks?.filter(t => 
    t.status !== "done" && 
    t.dueDate && 
    new Date(t.dueDate) < new Date()
  ) || [];

  const statusCountMap = new Map<string, number>();
  projectsByStatus?.forEach(item => {
    statusCountMap.set(item.status, item.count);
  });

  const totalPipelineProjects = projectsByStatus?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  const unpaidInvoices = invoices?.filter(i => i.status === "sent") || [];
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);

  const statCards = [
    {
      title: "My Projects",
      value: stats?.totalProjects ?? projects?.length ?? 0,
      subtitle: `${stats?.activeProjects ?? 0} active`,
      icon: FolderKanban,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Tasks",
      value: stats?.pendingTasks ?? pendingTasks.length,
      subtitle: `${stats?.completedTasks ?? 0} completed`,
      icon: ClipboardList,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Time Logged",
      value: "-",
      subtitle: "View time logs",
      icon: Clock,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
    {
      title: "Invoices",
      value: stats?.totalInvoices ?? invoices?.length ?? 0,
      subtitle: `$${totalOutstanding.toLocaleString()} outstanding`,
      icon: DollarSign,
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-dashboard-title">
          Welcome, {user?.firstName || "Client"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of your projects and activities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.subtitle}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPipelineProjects > 0 && (
        <Card data-testid="card-project-pipeline">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Project Status</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalPipelineProjects} total projects
              </p>
            </div>
            <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {STATUS_PIPELINE_ORDER.map((stage) => {
                const count = statusCountMap.get(stage.key) ?? 0;
                return (
                  <div
                    key={stage.key}
                    className="text-center p-3 rounded-lg bg-muted/30"
                    data-testid={`pipeline-stage-${stage.key}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${stage.color} mx-auto mb-2`} />
                    <div className="text-2xl font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground">{stage.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueTasks.length > 0 && (
        <Card className="border-destructive/50" data-testid="card-overdue-tasks">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg font-semibold text-destructive">
                Attention Required ({overdueTasks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5"
                  data-testid={`overdue-task-${task.id}`}
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.project?.name}
                    </p>
                  </div>
                  {task.dueDate && (
                    <Badge variant="outline" className="text-xs text-destructive border-destructive/30 shrink-0">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
            <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentProjects.length > 0 ? (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg hover-elevate cursor-pointer"
                    data-testid={`link-project-${project.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {project.county || "No county"}
                      </p>
                    </div>
                    <StatusBadge status={project.status} type="project" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
            <Link href="/tasks" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {pendingTasks.length > 0 ? (
              <div className="space-y-4">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg hover-elevate"
                    data-testid={`task-item-${task.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                      ) : task.status === "in_progress" ? (
                        <Clock className="h-4 w-4 text-chart-4 shrink-0" />
                      ) : (
                        <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.project?.name}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={task.status} type="task" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pending tasks</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
