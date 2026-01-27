import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
];

export default function ClientProjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const progress = getProgress(project);
            return (
              <Card key={project.id} className="hover-elevate" data-testid={`card-project-${project.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-semibold truncate">
                      {project.name}
                    </CardTitle>
                    <StatusBadge status={project.status} type="project" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {project.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate max-w-[150px]">{project.address}</span>
                      </div>
                    )}
                    {project.startDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatLocalDate(project.startDate)}</span>
                      </div>
                    )}
                  </div>

                  {project.county && (
                    <Badge variant="outline" className="text-xs">
                      {project.county}
                    </Badge>
                  )}

                  {(project.tasks?.length || 0) > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                    <Link href={`/projects/${project.id}`} data-testid={`button-view-project-${project.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
