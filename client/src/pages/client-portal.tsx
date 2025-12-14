import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  MapPin,
  Calendar,
  ClipboardList,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Timer,
  AlertCircle,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/useAuth";
import type { Project, Client, Task, Note, User } from "@shared/schema";
import { format } from "date-fns";

type ProjectWithRelations = Project & {
  client: Client;
  tasks: Task[];
  notes: (Note & { user: User })[];
};

export default function ClientPortal() {
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/client/projects"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, {user?.firstName || "Client"}
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Your projects will appear here once they are created"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">My Projects</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {user?.firstName || "Client"}. Here's the status of your projects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const completedTasks = project.tasks?.filter((t) => t.status === "done").length || 0;
          const totalTasks = project.tasks?.length || 0;
          
          return (
            <Card key={project.id} className="hover-elevate" data-testid={`card-client-project-${project.id}`}>
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
                  {project.county && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{project.county}</span>
                    </div>
                  )}
                  {project.startDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(project.startDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
                
                {totalTasks > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{completedTasks}/{totalTasks} tasks</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <Link href={`/project/${project.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2" data-testid={`button-view-project-${project.id}`}>
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ClientProjectDetail() {
  const { id } = window.location.pathname.split("/").pop() ? { id: window.location.pathname.split("/").pop() } : { id: "" };
  
  const { data: project, isLoading } = useQuery<ProjectWithRelations>({
    queryKey: ["/api/client/projects", id],
    enabled: !!id,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FolderKanban}
            title="Project not found"
            description="The project you're looking for doesn't exist"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to Projects
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
          <StatusBadge status={project.status} type="project" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {project.county && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">County</p>
                <p className="text-sm font-medium">{project.county} County</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.startDate && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">
                  {format(new Date(project.startDate), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.address && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium truncate">{project.address}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks ({project.tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Notes ({project.notes?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          {project.tasks && project.tasks.length > 0 ? (
            <div className="space-y-3">
              {project.tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 mt-0.5 text-chart-2" />
                      ) : task.status === "waiting_on_client" ? (
                        <AlertCircle className="h-5 w-5 mt-0.5 text-chart-3" />
                      ) : (
                        <Timer className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          <TaskTypeBadge type={task.type} />
                          <StatusBadge status={task.status} type="task" />
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
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
                  icon={ClipboardList}
                  title="No tasks yet"
                  description="Tasks will appear here as they are created"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          {project.notes && project.notes.length > 0 ? (
            <div className="space-y-4">
              {project.notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="py-4">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>{note.user?.firstName || "Team"}</span>
                      <span>•</span>
                      <span>{format(new Date(note.createdAt!), "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={MessageSquare}
                  title="No notes yet"
                  description="Notes will appear here as they are added"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
