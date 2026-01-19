import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Calendar, Clock, User, Mail, Phone, Check, Eye, EyeOff, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLocalDate, formatLocalDateTime } from "@/lib/dateUtils";
import type { TaskReminder, Task, Project } from "@shared/schema";

type ReminderWithContext = TaskReminder & { task: Task; project: Project };

const statusStyles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "outline", label: "Pending" },
  sent: { variant: "default", label: "Sent" },
  failed: { variant: "destructive", label: "Failed" },
  cancelled: { variant: "secondary", label: "Cancelled" },
  done: { variant: "default", label: "Done" },
  postponed: { variant: "secondary", label: "Postponed" },
};

function ReminderCard({ reminder, onToggleRead }: { reminder: ReminderWithContext; onToggleRead: (id: number, isRead: boolean) => void }) {
  const status = statusStyles[reminder.status] || statusStyles.pending;
  const scheduledDate = reminder.scheduledAt ? new Date(reminder.scheduledAt) : null;
  const isPast = scheduledDate ? scheduledDate < new Date() : false;

  return (
    <Card className={`${reminder.isRead ? "opacity-60" : ""} hover-elevate`} data-testid={`reminder-card-${reminder.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={status.variant} className="text-xs">
                {status.label}
              </Badge>
              {reminder.isRead && (
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Read
                </Badge>
              )}
              {isPast && reminder.status === "pending" && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
            </div>

            <p className="font-medium text-sm line-clamp-2">
              {reminder.message || "No message"}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {scheduledDate ? formatLocalDateTime(scheduledDate) : "-"}
              </div>
              {reminder.recipientEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {reminder.recipientEmail}
                </div>
              )}
              {reminder.recipientPhone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {reminder.recipientPhone}
                </div>
              )}
            </div>

            <Separator className="my-2" />

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <Link href={`/projects/${reminder.project.id}`}>
                <span className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                  <ExternalLink className="h-3 w-3" />
                  P-{reminder.project.id}: {reminder.project.name}
                </span>
              </Link>
              {reminder.project.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {reminder.project.address}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Task:</span> {reminder.task.title}
            </div>

            {reminder.actionNote && (
              <p className="text-xs text-muted-foreground italic">
                Note: {reminder.actionNote}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleRead(reminder.id, !reminder.isRead)}
              title={reminder.isRead ? "Mark as unread" : "Mark as read"}
              data-testid={`toggle-read-${reminder.id}`}
            >
              {reminder.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reminders() {
  const { toast } = useToast();

  const { data: reminders, isLoading } = useQuery<ReminderWithContext[]>({
    queryKey: ["/api/reminders"],
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const res = await apiRequest("PATCH", `/api/reminders/${id}`, { isRead });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleRead = (id: number, isRead: boolean) => {
    toggleReadMutation.mutate({ id, isRead });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const unreadReminders = reminders?.filter(r => !r.isRead) || [];
  const readReminders = reminders?.filter(r => r.isRead) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reminders</h1>
            <p className="text-sm text-muted-foreground">
              {unreadReminders.length} unread, {readReminders.length} read
            </p>
          </div>
        </div>
      </div>

      {reminders?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Reminders</h3>
            <p className="text-muted-foreground">You don't have any reminders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {unreadReminders.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Badge variant="default">{unreadReminders.length}</Badge>
                Unread Reminders
              </h2>
              <div className="grid gap-4">
                {unreadReminders.map(reminder => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onToggleRead={handleToggleRead}
                  />
                ))}
              </div>
            </div>
          )}

          {readReminders.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <Badge variant="secondary">{readReminders.length}</Badge>
                Read Reminders
              </h2>
              <div className="grid gap-4">
                {readReminders.map(reminder => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onToggleRead={handleToggleRead}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
