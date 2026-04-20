import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertTriangle,
  Calendar,
  Printer,
  Filter,
  X,
  FileText,
  DollarSign,
  NotebookPen,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { DailyActivityDialog } from "@/components/daily-activity-dialog";
import type { Project, Task, Client, Invoice } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { parseLocalDateFromISO, formatLocalDate } from "@/lib/dateUtils";

const DASHBOARD_REFETCH_INTERVAL_MS = 60_000;

interface DashboardSummary {
  stats: {
    totalClients: number;
    activeClients: number;
    totalProjects: number;
    activeProjects: number;
    pendingTasks: number;
    totalHours: number;
  };
  projectsByStatus: { status: string; count: number }[];
  overdueTasks: (Task & { project: Project })[];
  recentProjects: (Project & { client: Client })[];
  pendingTasksPreview: (Task & { project: Project })[];
  invoiceSummary: {
    totalCount: number;
    unpaidCount: number;
    unpaidTotal: number;
    paidCount: number;
  };
  unbilledHours: number;
}

const STATUS_PIPELINE_ORDER = [
  { key: "intake", label: "Intake", color: "bg-slate-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "waiting_on_client", label: "Waiting on Client", color: "bg-amber-500" },
  { key: "with_dob", label: "With DOB", color: "bg-purple-500" },
  { key: "on_hold", label: "On Hold", color: "bg-gray-500" },
  { key: "completed", label: "Completed", color: "bg-green-500" },
  { key: "cancelled", label: "Cancelled", color: "bg-red-500" },
] as const;

export default function Dashboard() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dailyActivityDialogOpen, setDailyActivityDialogOpen] = useState(false);

  const summaryQueryKey = startDate || endDate
    ? ["/api/dashboard/summary", { startDate, endDate }]
    : ["/api/dashboard/summary"];

  const { data: summary, isLoading, error: summaryError } = useQuery<DashboardSummary>({
    queryKey: summaryQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const url = `/api/dashboard/summary${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch dashboard (${res.status})`);
      return res.json();
    },
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
  });

  const dashboardErrors: { label: string; error: unknown }[] = summaryError
    ? [{ label: "Dashboard", error: summaryError }]
    : [];

  const stats = summary?.stats;
  const projectsByStatus = summary?.projectsByStatus;
  const overdueTasks = summary?.overdueTasks ?? [];
  const recentProjects = summary?.recentProjects;
  const pendingTasks = summary?.pendingTasksPreview;
  const invoiceSummary = summary?.invoiceSummary;
  const unbilledHours = summary?.unbilledHours ?? 0;
  const unpaidCount = invoiceSummary?.unpaidCount ?? 0;
  const unpaidTotal = invoiceSummary?.unpaidTotal ?? 0;

  // Create a map for easy lookup of counts by status
  const statusCountMap = new Map<string, number>();
  projectsByStatus?.forEach(item => {
    statusCountMap.set(item.status, item.count);
  });

  // Calculate total projects for pipeline
  const totalPipelineProjects = projectsByStatus?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const statsError = summaryError;
  const projectsError = summaryError;
  const clientsError = summaryError;
  const tasksError = summaryError;
  const pipelineError = summaryError;
  const overdueError = summaryError;
  const invoicesError = summaryError;
  const timeEntriesError = summaryError;

  const fetchReportData = async (key: string): Promise<any[]> => {
    return await queryClient.fetchQuery<any[]>({ queryKey: [key] });
  };

  const handlePrintReport = async (reportType: string) => {
    let reportTitle = "";
    let reportData: any[] = [];
    let invoicesForReport: any[] = [];

    try {
      switch (reportType) {
        case "clients":
          reportTitle = "Total Clients Report";
          reportData = await fetchReportData("/api/clients");
          break;
        case "projects":
          reportTitle = "Active Projects Report";
          reportData = (await fetchReportData("/api/projects")).filter(
            (p: any) => p.status !== "completed" && p.status !== "cancelled"
          );
          break;
        case "tasks":
          reportTitle = "Pending Tasks Report";
          reportData = (await fetchReportData("/api/tasks")).filter(
            (t: any) => t.status !== "done"
          );
          break;
        case "hours":
          reportTitle = "Total Hours Report";
          break;
        case "invoices":
          reportTitle = "Invoices Report";
          invoicesForReport = (await fetchReportData("/api/invoices")).filter(Boolean);
          reportData = invoicesForReport.filter((i: any) => i.status === "draft" || i.status === "sent");
          break;
      }
    } catch (e) {
      console.error("Failed to fetch report data", e);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString("en-US");
    
    let tableContent = "";
    if (reportType === "clients") {
      tableContent = `
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>County</th></tr>
          </thead>
          <tbody>
            ${reportData.map((c: any) => `
              <tr>
                <td>${c?.name ?? ""}</td>
                <td>${c?.company ?? "-"}</td>
                <td>${c?.email ?? "-"}</td>
                <td>${c?.phone ?? "-"}</td>
                <td>${c?.county ?? "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else if (reportType === "projects") {
      tableContent = `
        <table>
          <thead>
            <tr><th>Project Name</th><th>Client</th><th>Status</th><th>County</th><th>Address</th></tr>
          </thead>
          <tbody>
            ${reportData.map((p: any) => `
              <tr>
                <td>${p.name}</td>
                <td>${p.client?.name ?? "-"}</td>
                <td>${p.status?.replace(/_/g, " ")}</td>
                <td>${p.county ?? "-"}</td>
                <td>${p.address ?? "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else if (reportType === "tasks") {
      tableContent = `
        <table>
          <thead>
            <tr><th>Task</th><th>Project</th><th>Status</th><th>Type</th><th>Due Date</th></tr>
          </thead>
          <tbody>
            ${reportData.map((t: any) => `
              <tr>
                <td>${t.title}</td>
                <td>${t.project?.name ?? "-"}</td>
                <td>${t.status?.replace(/_/g, " ")}</td>
                <td>${t.type ?? "-"}</td>
                <td>${t.dueDate ? formatLocalDate(t.dueDate) : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else if (reportType === "hours") {
      tableContent = `
        <div class="summary">
          <p><strong>Total Hours:</strong> ${stats?.totalHours ?? 0} hours</p>
        </div>
      `;
    } else if (reportType === "invoices") {
      const draftInvoices = invoicesForReport.filter((i: any) => i.status === "draft");
      const sentInvoices = invoicesForReport.filter((i: any) => i.status === "sent");
      const paidInvoicesList = invoicesForReport.filter((i: any) => i.status === "paid");
      
      const draftTotal = draftInvoices.reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);
      const sentTotal = sentInvoices.reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);
      const paidTotal = paidInvoicesList.reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);
      
      const renderInvoiceTable = (invList: any[], sectionTitle: string, total: number) => {
        if (invList.length === 0) return "";
        return `
          <h2 style="margin-top: 30px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 8px;">${sectionTitle} (${invList.length})</h2>
          <table>
            <thead>
              <tr><th>Invoice #</th><th>Project</th><th>Date</th><th>Due Date</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${invList.map((inv: any) => `
                <tr>
                  <td>${inv.invoiceNumber}</td>
                  <td>${inv.project?.name ?? "-"}</td>
                  <td>${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-US") : "-"}</td>
                  <td>${inv.dueDate ? formatLocalDate(inv.dueDate) : "-"}</td>
                  <td>$${parseFloat(inv?.total || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join("")}
              <tr style="font-weight: bold; background: #f0f0f0;">
                <td colspan="4" style="text-align: right;">Subtotal:</td>
                <td>$${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        `;
      };
      
      tableContent = `
        <div class="summary">
          <p><strong>Total Invoices:</strong> ${(draftInvoices.length + sentInvoices.length + paidInvoicesList.length)}</p>
          <p><strong>Draft:</strong> ${draftInvoices.length} ($${draftTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</p>
          <p><strong>Sent:</strong> ${sentInvoices.length} ($${sentTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</p>
          <p><strong>Paid:</strong> ${paidInvoicesList.length} ($${paidTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</p>
        </div>
        ${renderInvoiceTable(draftInvoices, "Draft Invoices", draftTotal)}
        ${renderInvoiceTable(sentInvoices, "Sent Invoices", sentTotal)}
        ${renderInvoiceTable(paidInvoicesList, "Paid Invoices", paidTotal)}
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .date { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          .summary { padding: 20px; background: #f5f5f5; border-radius: 8px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>${reportTitle}</h1>
        <p class="date">Generated on: ${currentDate}</p>
        ${tableContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const activeClients = stats?.activeClients ?? 0;
  const totalProjectsCount = stats?.totalProjects ?? 0;
  const overdueCount = overdueTasks?.length ?? 0;

  const statCards = [
    {
      title: "Total Clients",
      value: summaryError ? "—" : stats?.totalClients ?? 0,
      subtitle: summaryError ? "Failed to load" : `${activeClients} active`,
      hasError: Boolean(summaryError),
      icon: Users,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
      reportType: "clients",
    },
    {
      title: "Active Projects",
      value: summaryError ? "—" : stats?.activeProjects ?? 0,
      subtitle: summaryError ? "Failed to load" : `${totalProjectsCount} total`,
      hasError: Boolean(summaryError),
      icon: FolderKanban,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
      reportType: "projects",
    },
    {
      title: "Pending Tasks",
      value: summaryError ? "—" : stats?.pendingTasks ?? 0,
      subtitle: summaryError ? "Failed to load" : `${overdueCount} due/overdue`,
      hasError: Boolean(summaryError),
      icon: ClipboardList,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
      reportType: "tasks",
    },
    {
      title: "Total Hours",
      value: summaryError ? "—" : stats?.totalHours ?? 0,
      subtitle: summaryError ? "Failed to load" : `${unbilledHours.toFixed(1)} unbilled`,
      hasError: Boolean(summaryError),
      icon: Clock,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
      reportType: "hours",
    },
    {
      title: "Invoices",
      value: summaryError ? "—" : invoiceSummary?.totalCount ?? 0,
      subtitle: summaryError ? "Failed to load" : `${unpaidCount} unpaid`,
      hasError: Boolean(summaryError),
      icon: DollarSign,
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
      reportType: "invoices",
    },
  ];

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your permit expediting operations
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button
            onClick={() => setDailyActivityDialogOpen(true)}
            className="gap-2"
            data-testid="button-log-daily-activity"
          >
            <NotebookPen className="h-4 w-4" />
            Log Daily Activity
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter Hours:</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="startDate" className="text-sm text-muted-foreground">From</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
              data-testid="input-start-date"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="endDate" className="text-sm text-muted-foreground">To</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
              data-testid="input-end-date"
            />
          </div>
          {(startDate || endDate) && (
            <Button variant="ghost" size="icon" onClick={clearDateFilters} data-testid="button-clear-date-filter">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {dashboardErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-dashboard-errors">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  Some dashboard data failed to load
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Affected: {dashboardErrors.map(e => e.label).join(", ")}. Try refreshing the page; if the problem persists, you may have been signed out or lack permission for these endpoints.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className={`cursor-pointer hover-elevate transition-all ${stat.hasError ? "border-destructive/50" : ""}`}
            onClick={() => handlePrintReport(stat.reportType)}
            data-testid={`stat-card-${stat.reportType}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  {"subtitle" in stat && stat.subtitle && (
                    <div className="text-sm text-muted-foreground">
                      {stat.subtitle}
                    </div>
                  )}
                </div>
                <Printer className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-job-pipeline" className={pipelineError ? "border-destructive/50" : ""}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Job Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-pipeline-total">
              {pipelineError
                ? "Couldn't load job pipeline counts"
                : `${totalPipelineProjects} total jobs across all stages`}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {STATUS_PIPELINE_ORDER.map((stage) => {
              const count = statusCountMap.get(stage.key) ?? 0;
              return (
                <Link
                  key={stage.key}
                  href={`/projects?status=${stage.key}`}
                  className="text-center p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer transition-all"
                  data-testid={`pipeline-stage-${stage.key}`}
                >
                  <div className={`w-3 h-3 rounded-full ${stage.color} mx-auto mb-2`} />
                  <div className="text-2xl font-bold text-foreground">
                    {pipelineError ? "—" : count}
                  </div>
                  <div className="text-xs text-muted-foreground">{stage.label}</div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className={overdueTasks.length > 0 ? "border-destructive/50" : ""} data-testid="card-overdue-tasks">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <CardTitle className={`text-lg font-semibold ${overdueTasks.length > 0 ? "text-destructive" : ""}`}>
              Due & Overdue Tasks ({overdueError ? "—" : overdueTasks.length})
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks?filter=overdue">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {overdueError ? (
            <p className="text-sm text-destructive" data-testid="text-overdue-error">Failed to load overdue tasks. Try refreshing the page.</p>
          ) : overdueTasks.length > 0 ? (
            <div className="space-y-3">
              {overdueTasks.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.projectId}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 hover-elevate cursor-pointer"
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
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <TaskTypeBadge type={task.type} />
                    {task.dueDate && (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(parseLocalDateFromISO(task.dueDate) || new Date(), { addSuffix: true })}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-overdue-tasks">No tasks are due or overdue right now.</p>
          )}
        </CardContent>
      </Card>

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
            {projectsError ? (
              <p className="text-sm text-destructive py-4" data-testid="text-recent-projects-error">Failed to load recent projects.</p>
            ) : recentProjects && recentProjects.length > 0 ? (
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
            {tasksError ? (
              <p className="text-sm text-destructive py-4" data-testid="text-pending-tasks-error">Failed to load tasks.</p>
            ) : pendingTasks && pendingTasks.length > 0 ? (
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

      <DailyActivityDialog
        isOpen={dailyActivityDialogOpen}
        onClose={() => setDailyActivityDialogOpen(false)}
      />
    </div>
  );
}
