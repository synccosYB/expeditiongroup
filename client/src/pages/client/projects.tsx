import { RecordWorkspace } from "@/components/record-workspace";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Search,
  MapPin,
  Calendar,
  Eye,
  ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Project, Client, Task } from "@shared/schema";
import { formatLocalDate } from "@/lib/dateUtils";

type ProjectWithRelations = Project & {
  client?: Client;
  tasks?: Task[];
};

const PROJECT_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "intake", label: "Intake" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_client", label: "Waiting on Client" },
  { value: "with_dob", label: "With DOB" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ClientProjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const searchString = useSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => {
    const status = new URLSearchParams(searchString).get("status");
    setStatusFilter(PROJECT_STATUSES.some(option => option.value === status) ? status! : "all");
  }, [searchString]);

  const { data: projects, isLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/client/projects"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.county?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getProgress = (project: ProjectWithRelations) => {
    const tasks = project.tasks || [];
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === "done").length;
    return Math.round((completed / tasks.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-projects-title">
          My Projects
        </h1>
        <p className="text-muted-foreground mt-1">
          View and track your permit expediting projects
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length > 0 ? (
        <RecordWorkspace key={`${searchTerm}:${statusFilter}`} records={filteredProjects} title={project => project.name} href={project => `/projects/${project.id}`}
          columns={[{label: "Project", render: project => project.name}, {label: "Stage", render: project => <StatusBadge status={project.status} type="project" />}, {label: "County", render: project => project.county ?? "—"}, {label: "Progress", render: project => project.tasks?.length ? `${getProgress(project)}%` : "—"}]}
          details={project => <dl><dt>Address</dt><dd>{project.address ?? "—"}</dd><dt>County</dt><dd>{project.county ?? "—"}</dd><dt>Stage</dt><dd><StatusBadge status={project.status} type="project" /></dd><dt>Started</dt><dd>{project.startDate ? formatLocalDate(project.startDate) : "—"}</dd><dt>Progress</dt><dd>{project.tasks?.length ? `${getProgress(project)}% complete` : "No tasks yet"}</dd></dl>}
          actions={project => <Button asChild size="icon" variant="ghost"><Link href={`/projects/${project.id}`} aria-label={`Open ${project.name}`} data-testid={`button-view-project-${project.id}`}><Eye className="h-4 w-4" /></Link></Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="No projects found"
              description={searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters"
                : "Your projects will appear here once they are created"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
