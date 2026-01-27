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
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { TimeEntry, Task, Project } from "@shared/schema";
import { format } from "date-fns";

type TimeEntryWithRelations = TimeEntry & { 
  task: Task;
  project: Project;
};

export default function ClientTimeLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

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
    return matchesSearch && matchesProject;
  }) || [];

  const totalMinutes = filteredEntries.reduce((sum, entry) => sum + (entry.totalMinutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-time-logs-title">
          Time Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          View time logged on your projects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {filteredEntries.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{entry.project?.name || "-"}</TableCell>
                    <TableCell>{entry.task?.title || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatDuration(entry.totalMinutes || 0)}
                      </Badge>
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
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Clock}
              title="No time logs found"
              description={searchTerm || projectFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Time logs will appear here as work is logged on your projects"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
