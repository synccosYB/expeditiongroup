import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { TaskReminder, Task, Project } from "@shared/schema";
import { format, isPast, isToday, isTomorrow } from "date-fns";

type ReminderWithTask = TaskReminder & { 
  task: Task & { project: Project };
};

const REMINDER_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ClientReminders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: reminders, isLoading } = useQuery<ReminderWithTask[]>({
    queryKey: ["/api/client/reminders"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredReminders = reminders?.filter((reminder) => {
    const matchesSearch =
      reminder.task?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reminder.task?.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reminder.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || reminder.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
        return <Phone className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-chart-2 text-white">Sent</Badge>;
      case "done":
        return <Badge className="bg-chart-2 text-white">Done</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-chart-3 border-chart-3">Pending</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDateLabel = (date: Date | string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    if (isPast(d)) return "Overdue";
    return format(d, "MMM d, yyyy");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-reminders-title">
          Reminders
        </h1>
        <p className="text-muted-foreground mt-1">
          View reminders for your project tasks
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reminders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-reminders"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {REMINDER_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredReminders.length > 0 ? (
        <div className="space-y-3">
          {filteredReminders.map((reminder) => (
            <Card
              key={reminder.id}
              className={reminder.status === "pending" && reminder.scheduledAt && isPast(new Date(reminder.scheduledAt)) ? "border-chart-3/50" : ""}
              data-testid={`card-reminder-${reminder.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    {getChannelIcon(reminder.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{reminder.task?.title || "Reminder"}</span>
                      {getStatusBadge(reminder.status)}
                    </div>
                    {reminder.message && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {reminder.message}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {reminder.task?.project && (
                        <span>Project: {reminder.task.project.name}</span>
                      )}
                      {reminder.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Scheduled: {getDateLabel(reminder.scheduledAt)} at {format(new Date(reminder.scheduledAt), "h:mm a")}
                        </span>
                      )}
                      {reminder.sentAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-chart-2" />
                          Sent: {format(new Date(reminder.sentAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      )}
                    </div>
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
              icon={Bell}
              title="No reminders found"
              description={searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Reminders will appear here as they are created for your tasks"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
