import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, FileText, MoreVertical, Pencil, Trash2, Clock, Calendar, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { DailyActivityDialog } from "@/components/daily-activity-dialog";

type DailyActivityLog = {
  id: number;
  userId: string;
  date: string;
  summary: string;
  details: string | null;
  hoursWorked: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
};

export default function ActivityLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLog, setEditingLog] = useState<DailyActivityLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<DailyActivityLog | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: activityLogs, isLoading } = useQuery<DailyActivityLog[]>({
    queryKey: ["/api/daily-activity-logs"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<DailyActivityLog> }) => {
      return await apiRequest("PATCH", `/api/daily-activity-logs/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-activity-logs"] });
      setEditingLog(null);
      toast({ title: "Activity log updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update activity log", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/daily-activity-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-activity-logs"] });
      setDeletingLog(null);
      toast({ title: "Activity log deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete activity log", variant: "destructive" });
    },
  });

  const filteredLogs = activityLogs?.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.summary.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query) ||
      log.user?.firstName?.toLowerCase().includes(query) ||
      log.user?.lastName?.toLowerCase().includes(query) ||
      log.user?.email?.toLowerCase().includes(query)
    );
  }) || [];

  const sortedLogs = [...filteredLogs].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getUserName = (log: DailyActivityLog) => {
    if (log.user?.firstName && log.user?.lastName) {
      return `${log.user.firstName} ${log.user.lastName}`;
    }
    return log.user?.email || "Unknown User";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Activity Logs</h1>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Activity Logs</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-activity-log">
          <Plus className="h-4 w-4 mr-2" />
          Log Activity
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-activity-logs"
          />
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="No activity logs"
              description={searchQuery ? "No logs match your search criteria" : "Start logging your daily activities"}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedLogs.map((log) => (
            <Card key={log.id} data-testid={`activity-log-item-${log.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="secondary" data-testid={`badge-date-${log.id}`}>
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(log.date), "EEEE, MMMM d, yyyy")}
                      </Badge>
                      {log.hoursWorked && (
                        <Badge variant="outline" data-testid={`badge-hours-${log.id}`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {log.hoursWorked} hours
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base" data-testid={`text-summary-${log.id}`}>
                      {log.summary}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Activity log actions" data-testid={`button-menu-${log.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingLog(log)}
                        data-testid={`button-edit-${log.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingLog(log)}
                        className="text-destructive"
                        data-testid={`button-delete-${log.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {log.details && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-details-${log.id}`}>
                    {log.details}
                  </p>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  Logged by {getUserName(log)} on {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DailyActivityDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />

      <Dialog open={!!editingLog} onOpenChange={() => setEditingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Activity Log</DialogTitle>
            <DialogDescription className="sr-only">Edit activity log entry details</DialogDescription>
          </DialogHeader>
          {editingLog && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editingLog.id,
                  updates: {
                    summary: formData.get("summary") as string,
                    details: formData.get("details") as string || null,
                    hoursWorked: formData.get("hoursWorked") as string || null,
                  },
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-summary">Summary</Label>
                  <Input
                    id="edit-summary"
                    name="summary"
                    defaultValue={editingLog.summary}
                    required
                    data-testid="input-edit-summary"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-details">Details</Label>
                  <Textarea
                    id="edit-details"
                    name="details"
                    defaultValue={editingLog.details || ""}
                    rows={5}
                    data-testid="textarea-edit-details"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-hours">Hours Worked</Label>
                  <Input
                    id="edit-hours"
                    name="hoursWorked"
                    defaultValue={editingLog.hoursWorked || ""}
                    placeholder="e.g., 8"
                    data-testid="input-edit-hours"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLog(null)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLog} onOpenChange={() => setDeletingLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity log from{" "}
              {deletingLog && format(new Date(deletingLog.date), "MMMM d, yyyy")}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLog && deleteMutation.mutate(deletingLog.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
