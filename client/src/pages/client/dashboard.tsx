import { OverviewWorkspace } from "@/components/overview-workspace";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { Project, Task, Invoice } from "@shared/schema";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

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

  const overdueTasks = tasks?.filter(t => {
    if (t.status === "done" || t.status === "cancelled" || !t.dueDate) return false;
    const dueDate = parseLocalDateFromISO(t.dueDate);
    if (!dueDate) return false;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return dueDate <= todayEnd;
  }) || [];

  const unpaidInvoices = invoices?.filter(Boolean).filter(i => i.status === "sent") || [];
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);

  const overdueCount = overdueTasks.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="mb-1 text-sm text-muted-foreground">Welcome, {user?.firstName || "Client"}</p><h1 className="font-semibold" data-testid="text-client-dashboard-title">Workspace overview</h1></div>
        <Button asChild><Link href="/projects">View projects<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </div>
      <div className="workspace-metrics">
        {[["Active projects", stats?.activeProjects ?? 0, "/projects"], ["Pending tasks", stats?.pendingTasks ?? tasks?.filter(t => t.status !== "done" && t.status !== "cancelled").length ?? 0, "/tasks"], ["Tasks due", overdueCount, "/tasks"], ["Outstanding", `$${totalOutstanding.toLocaleString()}`, "/invoices"]].map(([label, value, href]) => <Link key={label} href={String(href)} className="focus-visible:ring-2 focus-visible:ring-ring"><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-sm text-muted-foreground">{label}</div></Link>)}
      </div>
      <OverviewWorkspace projects={projects ?? []} tasks={tasks ?? []} statusCounts={projectsByStatus} />
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><Link href="/time-logs" className="text-primary hover:underline">View time logs</Link><Link href="/invoices" className="text-primary hover:underline">{stats?.totalInvoices ?? invoices?.length ?? 0} invoices</Link></div>
    </div>
  );
}
