import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  FolderKanban,
  ClipboardList,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Timer,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import type { Project, Task, Client } from "@shared/schema";

interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  pendingTasks: number;
  totalHoursThisWeek: number;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: allProjects, isLoading: projectsLoading } = useQuery<(Project & { client: Client })[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allTasks, isLoading: tasksLoading } = useQuery<(Task & { project: Project })[]>({
    queryKey: ["/api/tasks"],
  });

  const recentProjects = allProjects?.slice(0, 5);
  const pendingTasks = allTasks?.filter(t => t.status !== "done").slice(0, 5);

  const isLoading = statsLoading || projectsLoading || tasksLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const statCards = [
    {
      title: "Total Clients",
      value: stats?.totalClients ?? 0,
      icon: Users,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      title: "Active Projects",
      value: stats?.activeProjects ?? 0,
      icon: FolderKanban,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Pending Tasks",
      value: stats?.pendingTasks ?? 0,
      icon: ClipboardList,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Hours This Week",
      value: stats?.totalHoursThisWeek ?? 0,
      icon: Clock,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your permit expediting operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects && recentProjects.length > 0 ? (
              <div className="space-y-4">
                {recentProjects.slice(0, 5).map((project) => (
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
                        {project.client?.name} • {project.county || "No county"}
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
                <Button size="sm" className="mt-2" asChild>
                  <Link href="/projects">Create Project</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingTasks && pendingTasks.length > 0 ? (
              <div className="space-y-4">
                {pendingTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    data-testid={`task-item-${task.id}`}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-chart-2" />
                    ) : task.status === "waiting_on_client" ? (
                      <AlertCircle className="h-4 w-4 mt-0.5 text-chart-3" />
                    ) : (
                      <Timer className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.project?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TaskTypeBadge type={task.type} />
                    </div>
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
