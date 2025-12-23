import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  FolderKanban,
  CheckSquare,
  FileText,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AssociateTypeBadge, StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import type { Associate, Project, Task } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

interface AssociateWithRelations extends Associate {
  projects: Project[];
  tasks: (Task & { project?: Project })[];
}

export default function AssociateDetail() {
  const { id } = useParams<{ id: string }>();
  const associateId = parseInt(id || "0");

  const { data: associate, isLoading } = useQuery<AssociateWithRelations>({
    queryKey: ["/api/associates", associateId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/associates/${associateId}/full`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch associate");
      return response.json();
    },
    enabled: !!associateId,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!associate) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Associate not found</p>
        <Button asChild>
          <Link href="/associates">Back to Associates</Link>
        </Button>
      </div>
    );
  }

  const pendingTasks = associate.tasks?.filter(t => t.status !== "done" && t.status !== "cancelled") || [];
  const completedTasks = associate.tasks?.filter(t => t.status === "done") || [];
  const linkedProjects = associate.projects || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/associates" data-testid="button-back-to-associates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-associate-name">
              {associate.name}
            </h1>
            <AssociateTypeBadge type={associate.type} />
          </div>
          {associate.company && (
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {associate.company}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {associate.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${associate.email}`} className="text-sm hover:underline" data-testid="link-associate-email">
                  {associate.email}
                </a>
              </div>
            )}
            {associate.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${associate.phone}`} className="text-sm hover:underline" data-testid="text-associate-phone">
                  {associate.phone}
                </a>
              </div>
            )}
            {associate.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{associate.notes}</p>
                </div>
              </>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Linked Projects</p>
                <p className="font-semibold text-lg" data-testid="text-project-count">{linkedProjects.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active Tasks</p>
                <p className="font-semibold text-lg" data-testid="text-task-count">{pendingTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="grid w-full grid-cols-2" data-testid="tabs-associate-sections">
              <TabsTrigger value="tasks" data-testid="tab-tasks">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tasks ({associate.tasks?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="projects" data-testid="tab-projects">
                <FolderKanban className="h-4 w-4 mr-2" />
                Projects ({linkedProjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-4 space-y-4">
              {pendingTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Active Tasks</h3>
                  {pendingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Completed Tasks</h3>
                  {completedTasks.slice(0, 5).map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {completedTasks.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      + {completedTasks.length - 5} more completed tasks
                    </p>
                  )}
                </div>
              )}
              {associate.tasks?.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <CheckSquare className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">No tasks linked to this associate</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-4 space-y-3">
              {linkedProjects.length > 0 ? (
                linkedProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`card-project-${project.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{project.name}</p>
                              <StatusBadge status={project.status} />
                            </div>
                            {project.propertyAddress && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {project.propertyAddress}
                              </p>
                            )}
                          </div>
                          {project.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(project.createdAt), "MM/dd/yyyy")}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">No projects linked to this associate</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task & { project?: Project } }) {
  const isOverdue = task.dueDate && parseLocalDateFromISO(task.dueDate)! < new Date() && task.status !== "done";

  return (
    <Link href={`/projects/${task.projectId}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`card-task-${task.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{task.title}</p>
                <StatusBadge status={task.status} />
                {task.priority && task.priority !== "normal" && (
                  <Badge variant="outline" className="text-xs capitalize">{task.priority}</Badge>
                )}
              </div>
              {task.project && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" />
                  {task.project.name}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {task.dueDate && (
                <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {isOverdue && <AlertCircle className="h-3 w-3" />}
                  <Calendar className="h-3 w-3" />
                  {format(parseLocalDateFromISO(task.dueDate)!, "MM/dd/yyyy")}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
