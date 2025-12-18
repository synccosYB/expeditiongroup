import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Clock, ExternalLink, Calendar, CheckCircle, Pencil } from "lucide-react";
import { TaskTypeBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimeLog, TimeEntry, Project, User, Task } from "@shared/schema";
import { format } from "date-fns";
import { formatTimeRange12h } from "@/lib/dateUtils";

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
  const [editingLog, setEditingLog] = useState<UnifiedTimeLog | null>(null);
  const { toast } = useToast();

  const { data: timeLogs, isLoading: logsLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"],
  });

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries"],
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
    return matchesSearch && matchesType;
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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search time logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-time-logs"
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
                        {format(new Date(log.date), "MM/dd/yyyy")}
                      </span>
                      {log.startTime && log.endTime && (
                        <span>{formatTimeRange12h(log.startTime, log.endTime)}</span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{log.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {log.type && (log.type === "office" || log.type === "road") && <TaskTypeBadge type={log.type} />}
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {log.totalHours.toFixed(1)} hrs
                    </span>
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
              description={searchQuery || typeFilter !== "all"
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
  const [totalHours, setTotalHours] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"office" | "road">("office");
  const [isBillable, setIsBillable] = useState(true);

  const isLegacy = log?.source === "legacy";

  const handleOpen = () => {
    if (log) {
      const dateStr = log.date ? format(new Date(log.date), "yyyy-MM-dd") : "";
      setDate(dateStr);
      setStartTime(log.startTime || "");
      setEndTime(log.endTime || "");
      setTotalHours(log.totalHours.toFixed(2));
      setDescription(log.description || "");
      setNotes(log.notes || "");
      setType((log.type === "road" ? "road" : "office"));
      setIsBillable(log.isBillable);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Start Time</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="input-edit-time-log-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-time">End Time</Label>
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
            <Label htmlFor="edit-total-hours">Total Hours</Label>
            <Input
              id="edit-total-hours"
              type="number"
              step="0.25"
              min="0"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              data-testid="input-edit-time-log-total-hours"
            />
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
