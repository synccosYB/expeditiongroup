import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Search,
  Calendar,
  Timer,
  X,
  Printer,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { handlePrintWithWidgetRemoval, installPrintListeners } from "@/lib/printUtils";
import { PrintCompanyHeader, PrintStyles } from "@/components/printable-document";
import type { TimeEntry, Task, Project } from "@shared/schema";
import { format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

type TimeEntryWithRelations = TimeEntry & { 
  task: Task;
  project: Project;
};

export default function ClientTimeLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const cleanup = installPrintListeners();
    return cleanup;
  }, []);

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/client/time-entries"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/client/projects"],
  });

  if (entriesLoading) {
    return <DashboardSkeleton />;
  }

  const filteredEntries = timeEntries?.filter((entry) => {
    const matchesSearch =
      entry.task?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = projectFilter === "all" || entry.projectId === parseInt(projectFilter);
    let matchesDateRange = true;
    if (dateFrom && entry.date) {
      matchesDateRange = (parseLocalDateFromISO(entry.date) || new Date(0)) >= new Date(dateFrom + "T00:00:00");
    }
    if (dateTo && entry.date && matchesDateRange) {
      matchesDateRange = (parseLocalDateFromISO(entry.date) || new Date(0)) <= new Date(dateTo + "T23:59:59");
    }
    return matchesSearch && matchesProject && matchesDateRange;
  }) || [];

  const totalMinutes = filteredEntries.reduce((sum, entry) => sum + (entry.totalMinutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const billableMinutes = filteredEntries
    .filter(e => e.isBillable)
    .reduce((sum, entry) => sum + (entry.totalMinutes || 0), 0);
  const billableHours = Math.floor(billableMinutes / 60);
  const billableRemainingMinutes = billableMinutes % 60;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const hasDateFilter = dateFrom || dateTo;

  const clearDateFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  const handlePrint = () => {
    handlePrintWithWidgetRemoval({
      documentTitle: "Time Logs",
    });
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-time-logs-title">
            Time Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            View time logged on your projects
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} data-testid="button-print-time-logs">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print:hidden grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-4/10">
                <Clock className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {totalHours}h {remainingMinutes}m
                </p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-2/10">
                <Timer className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredEntries.length}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-3/10">
                <Clock className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {billableHours}h {billableRemainingMinutes}m
                </p>
                <p className="text-xs text-muted-foreground">Billable Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="print:hidden flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search time logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-time-logs"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-64" data-testid="select-project-filter">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 sm:max-w-[200px]">
            <Label className="text-sm text-muted-foreground mb-1 block">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="input-date-from"
            />
          </div>
          <div className="flex-1 sm:max-w-[200px]">
            <Label className="text-sm text-muted-foreground mb-1 block">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="input-date-to"
            />
          </div>
          {hasDateFilter && (
            <Button variant="ghost" size="sm" onClick={clearDateFilters} data-testid="button-clear-date-filter">
              <X className="h-4 w-4 mr-1" />
              Clear Dates
            </Button>
          )}
        </div>
      </div>

      {filteredEntries.length > 0 ? (
        <Card className="print:hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {entry.date ? format(parseLocalDateFromISO(entry.date)!, "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{entry.project?.name || "-"}</TableCell>
                    <TableCell>{entry.task?.title || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatDuration(entry.totalMinutes || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.isBillable ? (
                        <Badge variant="default" className="text-xs">Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="print:hidden">
          <CardContent className="p-0">
            <EmptyState
              icon={Clock}
              title="No time logs found"
              description={searchTerm || projectFilter !== "all" || hasDateFilter
                ? "Try adjusting your search or filters"
                : "Time logs will appear here as work is logged on your projects"}
            />
          </CardContent>
        </Card>
      )}

      <div className="hidden print:block" data-testid="time-logs-print-area">
        <div className="p-8">
          <PrintCompanyHeader
            rightTestId="time-logs-print-meta"
            right={
              <>
                <h2 className="text-lg font-semibold mb-4">Time Log Report</h2>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
                </div>
              </>
            }
          />

          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" data-testid="time-logs-print-title">Time Logs</h1>
            <p className="text-sm text-muted-foreground">
              {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}
              {(searchTerm || projectFilter !== "all" || hasDateFilter) ? " (filtered)" : ""}
              {dateFrom || dateTo ? ` · ${dateFrom || "…"} to ${dateTo || "…"}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-muted/30 rounded-md" data-testid="time-logs-info-grid">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Time</p>
              <p className="font-medium">{totalHours}h {remainingMinutes}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Billable Time</p>
              <p className="font-medium">{billableHours}h {billableRemainingMinutes}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Entries</p>
              <p className="font-medium">{filteredEntries.length}</p>
            </div>
          </div>

          {filteredEntries.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium w-28">Date</th>
                  <th className="text-left py-3 font-medium">Project</th>
                  <th className="text-left py-3 font-medium">Task</th>
                  <th className="text-right py-3 font-medium w-24">Duration</th>
                  <th className="text-left py-3 font-medium w-20">Billable</th>
                  <th className="text-left py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-3">{entry.date ? format(parseLocalDateFromISO(entry.date)!, "MMM d, yyyy") : "—"}</td>
                    <td className="py-3">{entry.project?.name || "—"}</td>
                    <td className="py-3">{entry.task?.title || "—"}</td>
                    <td className="py-3 text-right">{formatDuration(entry.totalMinutes || 0)}</td>
                    <td className="py-3">{entry.isBillable ? "Yes" : "No"}</td>
                    <td className="py-3 whitespace-pre-wrap break-words">{entry.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No time entries to display.</p>
          )}
        </div>
      </div>

      <PrintStyles
        cardLayout={false}
        extraCss={`
          @media print {
            html { color: #111 !important; }
            [data-testid="time-logs-print-area"] {
              background: white !important;
              color: #111 !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
            }
            [data-testid="time-logs-print-area"] * {
              color: #111 !important;
              background-color: transparent !important;
              border-color: #ddd !important;
            }
            [data-testid="time-logs-print-area"] .mb-8 { margin-bottom: 1rem !important; }
            [data-testid="time-logs-info-grid"] {
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              gap: 1rem !important;
              padding: 0.75rem 1rem !important;
              background-color: #f5f5f5 !important;
            }
            [data-testid="time-logs-info-grid"] p { color: #111 !important; }
            [data-testid="time-logs-info-grid"] .text-xs { color: #666 !important; }
            [data-testid="time-logs-print-meta"] p { color: #555 !important; }
            [data-testid="invoice-company-info"] p { color: #555 !important; }
            th { color: #111 !important; border-bottom: 2px solid #333 !important; }
            td { color: #111 !important; border-bottom: 1px solid #ddd !important; }
            .space-y-6 > * { margin: 0 !important; }
          }
        `}
      />
    </div>
  );
}
