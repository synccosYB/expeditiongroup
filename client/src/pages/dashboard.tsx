import { OverviewWorkspace, type OverviewProject, type OverviewTask } from "@/components/overview-workspace";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { useEffect, useState } from "react";
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
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
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
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const summaryQueryKey = startDate || endDate
    ? ["/api/dashboard/summary", { startDate, endDate }]
    : ["/api/dashboard/summary"];

  const { data: summary, isLoading, isFetching, dataUpdatedAt, error: summaryError } = useQuery<DashboardSummary>({
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

  const { data: workspaceProjects } = useQuery<OverviewProject[]>({ queryKey: ["/api/projects"], refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS });
  const { data: workspaceTasks } = useQuery<OverviewTask[]>({ queryKey: ["/api/tasks"], refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS });

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

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-semibold">Workspace overview</h1><p className="mt-1 text-sm text-muted-foreground">Your projects, priorities, and progress.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDailyActivityDialogOpen(true)}><NotebookPen className="mr-2 h-4 w-4" />Log activity</Button><Button asChild><Link href="/projects">View projects<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    </div>
    {summaryError && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Dashboard data could not load. Please refresh.</p>}
    <div className="workspace-metrics">
      {[["Active projects", stats?.activeProjects, "/projects"], ["Pending tasks", stats?.pendingTasks, "/tasks"], ["Unpaid invoices", unpaidCount, "/invoices"], ["Unbilled hours", unbilledHours.toFixed(1), "/time-logs"]].map(([label,value,url]) => <Link key={label} href={String(url)} className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring"><div className="text-2xl font-semibold tabular-nums">{summaryError ? "—" : value ?? 0}</div><div className="text-sm text-muted-foreground">{label}</div></Link>)}
    </div>
    <OverviewWorkspace projects={workspaceProjects ?? recentProjects ?? []} tasks={workspaceTasks ?? Array.from(new Map([...(pendingTasks ?? []), ...overdueTasks].map(task => [task.id, task])).values())} showClient statusCounts={projectsByStatus} />
    <details className="rounded-lg border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Hours filters & reports</summary><div className="mt-3 flex flex-wrap items-center gap-3"><Label htmlFor="startDate">From</Label><Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" /><Label htmlFor="endDate">To</Label><Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" /><Button variant="outline" size="sm" onClick={clearDateFilters}>Clear</Button>{statCards.map(stat => <Button key={stat.title} size="sm" variant="outline" onClick={() => handlePrintReport(stat.reportType)}><Printer className="mr-2 h-3 w-3" />{stat.title}</Button>)}</div></details>
    <DailyActivityDialog isOpen={dailyActivityDialogOpen} onClose={() => setDailyActivityDialogOpen(false)} />
  </div>;
}
