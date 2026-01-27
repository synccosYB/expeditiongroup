import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  FileText,
  Search,
  User,
  Calendar,
  Upload,
  Download,
  Eye,
  Edit,
  Trash,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { AuditLog } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

type AuditLogWithUser = AuditLog & { 
  user?: { firstName?: string | null; lastName?: string | null; email: string };
};

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "view", label: "View" },
  { value: "upload", label: "Upload" },
  { value: "download", label: "Download" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "status_change", label: "Status Change" },
  { value: "document_uploaded", label: "Document Uploaded" },
  { value: "document_reviewed", label: "Document Reviewed" },
];

export default function ClientActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: activityLogs, isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["/api/client/activity"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredLogs = activityLogs?.filter((log) => {
    const matchesSearch =
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  }) || [];

  const getActionIcon = (action: string) => {
    switch (action) {
      case "login":
        return <LogIn className="h-4 w-4 text-chart-2" />;
      case "logout":
        return <LogOut className="h-4 w-4 text-muted-foreground" />;
      case "upload":
      case "document_uploaded":
        return <Upload className="h-4 w-4 text-chart-4" />;
      case "download":
        return <Download className="h-4 w-4 text-chart-5" />;
      case "view":
        return <Eye className="h-4 w-4 text-primary" />;
      case "create":
        return <CheckCircle className="h-4 w-4 text-chart-2" />;
      case "update":
        return <Edit className="h-4 w-4 text-chart-3" />;
      case "delete":
        return <Trash className="h-4 w-4 text-destructive" />;
      case "document_accepted":
        return <CheckCircle className="h-4 w-4 text-chart-2" />;
      case "document_rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      login: { label: "Login", variant: "default" },
      logout: { label: "Logout", variant: "secondary" },
      upload: { label: "Upload", variant: "default" },
      download: { label: "Download", variant: "outline" },
      view: { label: "View", variant: "outline" },
      create: { label: "Create", variant: "default" },
      update: { label: "Update", variant: "secondary" },
      delete: { label: "Delete", variant: "destructive" },
      status_change: { label: "Status Change", variant: "outline" },
      document_uploaded: { label: "Document Uploaded", variant: "default" },
      document_reviewed: { label: "Document Reviewed", variant: "outline" },
      document_accepted: { label: "Document Accepted", variant: "default" },
      document_rejected: { label: "Document Rejected", variant: "destructive" },
    };
    const config = actionLabels[action] || { label: action, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-activity-logs-title">
          Activity Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          View activity history for your account and projects
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-activity"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-action-filter">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length > 0 ? (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} data-testid={`card-activity-${log.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(log.action)}
                      <span className="text-sm text-muted-foreground capitalize">
                        {log.entityType}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-sm text-foreground mt-1">
                        {log.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {log.user && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.user.firstName && log.user.lastName
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : log.user.email}
                        </span>
                      )}
                      {log.createdAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
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
              icon={FileText}
              title="No activity logs found"
              description={searchTerm || actionFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Activity will be recorded here as you interact with your projects"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
