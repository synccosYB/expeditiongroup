import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Clock, ExternalLink, Calendar, CheckCircle, Pencil, FileText, Loader2 } from "lucide-react";
import { TaskTypeBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimeLog, TimeEntry, Project, User, Task, Client, Invoice } from "@shared/schema";
import { formatTimeRange12h, formatLocalDate, parseLocalDateFromISO } from "@/lib/dateUtils";

type TimeLogWithRelations = TimeLog & { project: Project; user?: User };
type TimeEntryWithRelations = TimeEntry & { project: Project; task: Task };

type UnifiedTimeLog = {
  id: string;
  originalId: number;
  source: "legacy" | "entry";
  description: string;
  projectId: number;
  projectName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  totalHours: number;
  type: string | null;
  isBillable: boolean;
  notes: string | null;
};

type TimeLogUpdates = {
  date?: Date;
  startTime?: string | null;
  endTime?: string | null;
  totalHours?: string;
  taskDescription?: string;
  notes?: string | null;
  type?: "office" | "road";
  isBillable?: boolean;
};

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "road", label: "Road" },
  { value: "office", label: "Office" },
];

export default function TimeLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingLog, setEditingLog] = useState<UnifiedTimeLog | null>(null);
  const [generatingInvoiceFor, setGeneratingInvoiceFor] = useState<string | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: timeLogs, isLoading: logsLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"],
  });

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries"],
  });

  const { data: projects } = useQuery<(Project & { client: Client })[]>({
    queryKey: ["/api/projects"],
  });

  const { data: invoices } = useQuery<(Invoice & { items?: { timeLogId?: number | null; timeEntryId?: number | null }[] })[]>({
    queryKey: ["/api/invoices"],
  });

  // Build sets of already-billed time log/entry IDs (excluding cancelled invoices)
  const billedTimeLogIds = new Set<number>();
  const billedTimeEntryIds = new Set<number>();
  invoices?.filter(Boolean).forEach(invoice => {
    if (invoice?.status !== "cancelled") {
      invoice?.items?.forEach(item => {
        if (item.timeLogId) billedTimeLogIds.add(item.timeLogId);
        if (item.timeEntryId) billedTimeEntryIds.add(item.timeEntryId);
      });
    }
  });

  const isLoading = logsLoading || entriesLoading;

  const updateTimeLogMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<TimeLog> }) => {
      return await apiRequest("PATCH", `/api/time-logs/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"] });
      setEditingLog(null);
      toast({ title: "Time log updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update time log", variant: "destructive" });
    },
  });

  const updateTimeEntryMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<TimeEntry> }) => {
      return await apiRequest("PATCH", `/api/time-entries/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setEditingLog(null);
      toast({ title: "Time entry updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update time entry", variant: "destructive" });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (log: UnifiedTimeLog) => {
      const project = projects?.find(p => p.id === log.projectId);
      if (!project?.client) {
        throw new Error("Project or client not found");
      }
      
      // Get next invoice number
      const nextNumberRes = await fetch("/api/invoices/next-number", { credentials: "include" });
      if (!nextNumberRes.ok) throw new Error("Failed to get invoice number");
      const { invoiceNumber } = await nextNumberRes.json();
      
      const hourlyRate = project.client.hourlyRate || "75";
      const hours = log.totalHours;
      const amount = (hours * parseFloat(hourlyRate)).toFixed(2);
      const dateStr = formatLocalDate(log.date);
      
      const invoiceData = {
        invoiceNumber,
        projectId: log.projectId,
        clientId: project.clientId,
        status: "draft",
        hourlyRate,
        subtotal: amount,
        total: amount,
        items: [{
          description: `${dateStr} - ${log.description}`,
          quantity: hours.toFixed(2),
          unitPrice: hourlyRate,
          amount,
          timeLogId: log.source === "legacy" ? log.originalId : null,
          timeEntryId: log.source === "entry" ? log.originalId : null,
          isCustom: false,
        }],
      };
      
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: (invoice: Invoice) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice generated successfully" });
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to generate invoice", variant: "destructive" });
      setGeneratingInvoiceFor(null);
    },
  });

  const handleGenerateInvoice = (log: UnifiedTimeLog) => {
    if (!log.isBillable) {
      toast({ title: "This time log is not billable", variant: "destructive" });
      return;
    }
    setGeneratingInvoiceFor(log.id);
    generateInvoiceMutation.mutate(log);
  };

  const unifiedLogs: UnifiedTimeLog[] = [
    ...(timeLogs?.map((log) => ({
      id: `log-${log.id}`,
      originalId: log.id,
      source: "legacy" as const,
      description: log.taskDescription,
      projectId: log.projectId,
      projectName: log.project?.name || "Unknown Project",
      date: log.date as unknown as string,
      startTime: log.startTime,
      endTime: log.endTime,
      totalHours: parseFloat(log.totalHours || "0"),
      type: log.type,
      isBillable: true,
      notes: log.notes,
    })) || []),
    ...(timeEntries?.map((entry) => ({
      id: `entry-${entry.id}`,
      originalId: entry.id,
      source: "entry" as const,
      description: entry.task?.title || "Task",
      projectId: entry.projectId,
      projectName: entry.project?.name || "Unknown Project",
      date: entry.date as unknown as string,
      startTime: entry.startTime,
      endTime: entry.endTime,
      totalHours: (entry.totalMinutes || 0) / 60,
      type: entry.task?.locationType || null,
      isBillable: entry.isBillable ?? true,
      notes: entry.notes,
    })) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLogs = unifiedLogs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;

    let matchesDateRange = true;
    if (dateFrom || dateTo) {
      const parsed = log.date ? parseLocalDateFromISO(log.date) : null;
      if (parsed) {
        const logYmd = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        if (dateFrom && logYmd < dateFrom) matchesDateRange = false;
        if (dateTo && logYmd > dateTo) matchesDateRange = false;
      }
    }

    return matchesSearch && matchesType && matchesDateRange;
  });

  const totalHours = filteredLogs.reduce((sum, log) => sum + log.totalHours, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Time Logs</h1>
            <p className="text-muted-foreground mt-1">Track time spent on projects</p>
          </div>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Time Logs</h1>
          <p className="text-muted-foreground mt-1">Track time spent on projects</p>
        </div>
        <Card className="sm:min-w-48">
          <CardContent className="py-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-lg font-semibold">{totalHours.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search time logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-time-logs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date-from" className="text-sm text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
            data-testid="input-date-from"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date-to" className="text-sm text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
            data-testid="input-date-to"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-time-log-type-filter">
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
        {(dateFrom || dateTo || typeFilter !== "all" || searchQuery) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery("");
              setTypeFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {filteredLogs.length > 0 ? (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="hover-elevate" data-testid={`card-time-log-${log.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{log.description}</p>
                      {log.isBillable && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Billable
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <Link href={`/projects/${log.projectId}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {log.projectName}
                      </Link>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatLocalDate(log.date)}
                      </span>
                      {log.startTime && log.endTime && (
                        <span>{formatTimeRange12h(log.startTime, log.endTime)}</span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{log.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {log.type && (log.type === "office" || log.type === "road") && <TaskTypeBadge type={log.type} />}
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {log.totalHours.toFixed(1)} hrs
                    </span>
                    {log.isBillable && (() => {
                      const isAlreadyBilled = log.source === "legacy" 
                        ? billedTimeLogIds.has(log.originalId)
                        : billedTimeEntryIds.has(log.originalId);
                      
                      if (isAlreadyBilled) {
                        return (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Billed
                          </Badge>
                        );
                      }
                      
                      return (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGenerateInvoice(log)}
                          disabled={generatingInvoiceFor === log.id}
                          data-testid={`button-generate-invoice-${log.id}`}
                          title="Generate Invoice"
                        >
                          {generatingInvoiceFor === log.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                      );
                    })()}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingLog(log)}
                      data-testid={`button-edit-time-log-${log.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
              icon={Clock}
              title="No time logs found"
              description={searchQuery || typeFilter !== "all" || dateFrom || dateTo
                ? "Try adjusting your filters"
                : "Time logs will appear here when you log time on projects"}
            />
          </CardContent>
        </Card>
      )}

      <EditTimeLogDialog
        log={editingLog}
        onClose={() => setEditingLog(null)}
        onSave={(updates: TimeLogUpdates) => {
          if (!editingLog) return;
          if (editingLog.source === "legacy") {
            updateTimeLogMutation.mutate({ id: editingLog.originalId, updates });
          } else {
            const entryUpdates: Partial<TimeEntry> = {
              date: updates.date,
              startTime: updates.startTime,
              endTime: updates.endTime,
              totalMinutes: updates.totalHours ? Math.round(parseFloat(updates.totalHours) * 60) : undefined,
              notes: updates.notes,
              isBillable: updates.isBillable,
            };
            updateTimeEntryMutation.mutate({ id: editingLog.originalId, updates: entryUpdates });
          }
        }}
        isPending={updateTimeLogMutation.isPending || updateTimeEntryMutation.isPending}
      />
    </div>
  );
}

function EditTimeLogDialog({
  log,
  onClose,
  onSave,
  isPending,
}: {
  log: UnifiedTimeLog | null;
  onClose: () => void;
  onSave: (updates: TimeLogUpdates) => void;
  isPending: boolean;
}) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"office" | "road">("office");
  const [isBillable, setIsBillable] = useState(true);

  const isLegacy = log?.source === "legacy";

  useEffect(() => {
    if (!startTime || !endTime) return;
    
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return;
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    const diffMinutes = endMinutes - startMinutes;
    
    if (durationUnit === "minutes") {
      setDuration(diffMinutes.toString());
    } else {
      setDuration((diffMinutes / 60).toFixed(2));
    }
  }, [startTime, endTime, durationUnit]);

  const handleOpen = () => {
    if (log) {
      const parsed = log.date ? parseLocalDateFromISO(log.date) : null;
      const dateStr = parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` : "";
      setDate(dateStr);
      setStartTime(log.startTime || "");
      setEndTime(log.endTime || "");
      const totalMinutes = Math.round(log.totalHours * 60);
      setDuration(totalMinutes.toString());
      setDurationUnit("minutes");
      setDescription(log.description || "");
      setNotes(log.notes || "");
      setType((log.type === "road" ? "road" : "office"));
      setIsBillable(log.isBillable);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationValue = parseFloat(duration) || 0;
    const totalHours = durationUnit === "minutes" 
      ? (durationValue / 60).toFixed(2) 
      : durationValue.toFixed(2);
    
    if (isLegacy) {
      onSave({
        date: date ? new Date(date) : undefined,
        startTime: startTime || null,
        endTime: endTime || null,
        totalHours: totalHours,
        taskDescription: description,
        notes: notes || null,
        type: type,
      });
    } else {
      onSave({
        date: date ? new Date(date) : undefined,
        startTime: startTime || null,
        endTime: endTime || null,
        totalHours: totalHours,
        notes: notes || null,
        isBillable: isBillable,
      });
    }
  };

  return (
    <Dialog open={!!log} onOpenChange={(open) => {
      if (open) handleOpen();
      else onClose();
    }}>
      <DialogContent className="max-w-md" data-testid="dialog-edit-time-log">
        <DialogHeader>
          <DialogTitle>Edit Time Log</DialogTitle>
          <DialogDescription className="sr-only">Edit time log entry details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="input-edit-time-log-date"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Start</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="input-edit-time-log-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-time">End</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="input-edit-time-log-end-time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-duration">Duration</Label>
            <div className="flex gap-2">
              <Input
                id="edit-duration"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="flex-1"
                data-testid="input-edit-time-log-duration"
              />
              <Select value={durationUnit} onValueChange={(val) => setDurationUnit(val as "minutes" | "hours")}>
                <SelectTrigger className="w-20 sm:w-24" data-testid="select-edit-time-log-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Min</SelectItem>
                  <SelectItem value="hours">Hrs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLegacy && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="textarea-edit-time-log-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select value={type} onValueChange={(val) => setType(val as "office" | "road")}>
                  <SelectTrigger data-testid="select-edit-time-log-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="road">Road</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="textarea-edit-time-log-notes"
            />
          </div>

          {!isLegacy && (
            <div className="flex items-center gap-2">
              <Switch
                id="edit-billable"
                checked={isBillable}
                onCheckedChange={setIsBillable}
                data-testid="switch-edit-time-log-billable"
              />
              <Label htmlFor="edit-billable">Billable</Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit-time-log">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-edit-time-log">
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
