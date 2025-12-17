import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Clock, ExternalLink, Calendar } from "lucide-react";
import { TaskTypeBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import type { TimeLog, Project, User } from "@shared/schema";
import { format } from "date-fns";

type TimeLogWithRelations = TimeLog & { project: Project; user: User };

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "road", label: "Road" },
  { value: "office", label: "Office" },
];

export default function TimeLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: timeLogs, isLoading } = useQuery<TimeLogWithRelations[]>({
    queryKey: ["/api/time-logs"],
  });

  const filteredLogs = timeLogs?.filter((log) => {
    const matchesSearch =
      log.taskDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.project?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalHours = filteredLogs?.reduce((sum, log) => sum + parseFloat(log.totalHours || "0"), 0) || 0;

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

      {filteredLogs && filteredLogs.length > 0 ? (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="hover-elevate" data-testid={`card-time-log-${log.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.taskDescription}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <Link href={`/projects/${log.project?.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {log.project?.name}
                      </Link>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.date), "MM/dd/yyyy")}
                      </span>
                      {log.startTime && log.endTime && (
                        <span>{log.startTime} - {log.endTime}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <TaskTypeBadge type={log.type} />
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {log.totalHours} hrs
                    </span>
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
    </div>
  );
}
