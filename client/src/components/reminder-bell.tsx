import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Check, Clock, Trash2, X, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { TaskReminder, Task, Project } from "@shared/schema";

type ReminderWithDetails = TaskReminder & { task: Task; project: Project };

export function ReminderBell() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteReminder, setDeleteReminder] = useState<ReminderWithDetails | null>(null);
  const [actionReminder, setActionReminder] = useState<ReminderWithDetails | null>(null);
  const [actionType, setActionType] = useState<"done" | "postponed" | null>(null);
  const [actionNote, setActionNote] = useState("");

  const { data: reminders = [], isLoading } = useQuery<ReminderWithDetails[]>({
    queryKey: ["/api/reminders"],
  });

  const pendingReminders = reminders.filter(r => r.status === "pending");
  const pendingCount = pendingReminders.length;

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: number) => {
      return await apiRequest("DELETE", `/api/reminders/${reminderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Reminder deleted" });
      setDeleteReminder(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete reminder", variant: "destructive" });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, status, actionNote }: { id: number; status: string; actionNote?: string }) => {
      return await apiRequest("PATCH", `/api/reminders/${id}`, { status, actionNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: actionType === "done" ? "Reminder marked as done" : "Reminder postponed" });
      setActionReminder(null);
      setActionType(null);
      setActionNote("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update reminder", variant: "destructive" });
    },
  });

  const handleAction = (reminder: ReminderWithDetails, type: "done" | "postponed") => {
    setActionReminder(reminder);
    setActionType(type);
    setActionNote("");
  };

  const confirmAction = () => {
    if (!actionReminder || !actionType) return;
    updateReminderMutation.mutate({
      id: actionReminder.id,
      status: actionType,
      actionNote: actionNote || undefined,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "done": return "default";
      case "postponed": return "outline";
      case "sent": return "default";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" data-testid="button-reminder-bell">
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                data-testid="badge-reminder-count"
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Reminders</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingCount} pending reminder{pendingCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ScrollArea className="h-80">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : reminders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No reminders yet
              </div>
            ) : (
              <div className="divide-y">
                {reminders.map((reminder) => (
                  <div 
                    key={reminder.id} 
                    className={`p-3 ${reminder.status !== "pending" ? "opacity-60" : ""}`}
                    data-testid={`reminder-item-${reminder.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {reminder.task?.title || "Task"}
                          </span>
                          <Badge variant={getStatusBadgeVariant(reminder.status)} className="text-xs">
                            {reminder.status}
                          </Badge>
                        </div>
                        <Link 
                          href={`/projects/${reminder.project?.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setIsOpen(false)}
                        >
                          P-{reminder.project?.id}: {reminder.project?.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {reminder.channel === "email" && <Mail className="h-3 w-3" />}
                          {reminder.channel !== "email" && <Phone className="h-3 w-3" />}
                          <span>{reminder.recipientEmail || reminder.recipientPhone}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(reminder.scheduledAt), "MMM d, yyyy h:mm a")}
                        </div>
                        {reminder.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {reminder.message}
                          </p>
                        )}
                        {reminder.actionNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {reminder.actionNote}
                          </p>
                        )}
                      </div>
                      {reminder.status === "pending" && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAction(reminder, "done")}
                            title="Mark as done"
                            data-testid={`button-done-${reminder.id}`}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAction(reminder, "postponed")}
                            title="Postpone"
                            data-testid={`button-postpone-${reminder.id}`}
                          >
                            <Clock className="h-4 w-4 text-yellow-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteReminder(reminder)}
                            title="Delete"
                            data-testid={`button-delete-${reminder.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <AlertDialog open={!!deleteReminder} onOpenChange={(open) => !open && setDeleteReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReminder && deleteReminderMutation.mutate(deleteReminder.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteReminderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!actionReminder && !!actionType} onOpenChange={(open) => {
        if (!open) {
          setActionReminder(null);
          setActionType(null);
          setActionNote("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "done" ? "Mark Reminder as Done" : "Postpone Reminder"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "done" 
                ? "This reminder will be marked as completed."
                : "This reminder will be marked as postponed."}
            </DialogDescription>
          </DialogHeader>
          {actionReminder && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm">{actionReminder.task?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Project: {actionReminder.project?.name}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="action-note">Note (optional)</Label>
            <Textarea
              id="action-note"
              placeholder="Add a note about this action..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              data-testid="textarea-action-note"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionReminder(null);
                setActionType(null);
                setActionNote("");
              }}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateReminderMutation.isPending}
              data-testid="button-confirm-action"
            >
              {updateReminderMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
