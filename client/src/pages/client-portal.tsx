import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  MapPin,
  Calendar,
  ClipboardList,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Timer,
  AlertCircle,
  FileText,
  Upload,
  Send,
  Clock,
  AlertTriangle,
  Receipt,
  DollarSign,
  Flag,
  Reply,
  X,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Client, Task, Note, User, Document, Invoice, ClientPortalSettings } from "@shared/schema";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

type ProjectWithRelations = Project & {
  client: Client;
  tasks: Task[];
  notes: (Note & { user: User })[];
};

type ClientTodo = Task & { project: Project };

function getStatusTimelineColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-chart-2";
    case "in_progress":
      return "bg-chart-4";
    case "on_hold":
      return "bg-chart-3";
    case "cancelled":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

type InvoiceWithProject = Invoice & { project?: Project };

export default function ClientPortal() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: portalSettings, isLoading: settingsLoading } = useQuery<ClientPortalSettings>({
    queryKey: ["/api/client/portal-settings"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/client/projects"],
    enabled: !!portalSettings?.showProjects,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<InvoiceWithProject[]>({
    queryKey: ["/api/client/invoices"],
    enabled: !!portalSettings?.showInvoices,
  });

  const { data: clientTodos } = useQuery<ClientTodo[]>({
    queryKey: ["/api/client/todos"],
  });

  if (settingsLoading || projectsLoading) {
    return <DashboardSkeleton />;
  }

  const activeProjects = projects?.filter(p => 
    p.status === "in_progress" || 
    p.status === "intake" || 
    p.status === "waiting_on_client" ||
    p.status === "with_dob" ||
    p.status === "on_hold"
  ) || [];
  const completedProjects = projects?.filter(p => p.status === "completed") || [];
  const pendingTodos = clientTodos?.filter(t => t.status !== "done") || [];
  const unpaidInvoices = invoices?.filter(inv => inv.status === "sent") || [];
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-portal-welcome">
          Welcome, {user?.firstName || "Client"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your projects and complete pending tasks
        </p>
      </div>

      {pendingTodos.length > 0 && (
        <Card className="border-chart-3/50 bg-chart-3/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-chart-3" />
              Action Required ({pendingTodos.length})
            </CardTitle>
            <CardDescription>These tasks need your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTodos.slice(0, 3).map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md bg-background border hover-elevate"
                  data-testid={`card-client-todo-${todo.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Upload className="h-4 w-4 text-chart-3 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{todo.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {todo.project.name}
                      </p>
                    </div>
                  </div>
                  {todo.dueDate && (
                    <Badge variant={isPast(parseLocalDateFromISO(todo.dueDate)!) ? "destructive" : "outline"} className="shrink-0">
                      {format(parseLocalDateFromISO(todo.dueDate)!, "MM/dd/yyyy")}
                    </Badge>
                  )}
                </div>
              ))}
              {pendingTodos.length > 3 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{pendingTodos.length - 3} more items requiring action
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {portalSettings?.showProjects && activeProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} onView={() => setLocation(`/project/${project.id}`)} />
            ))}
          </div>
        </div>
      )}

      {portalSettings?.showProjects && completedProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">Completed Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedProjects.slice(0, 3).map((project) => (
              <ProjectCard key={project.id} project={project} onView={() => setLocation(`/project/${project.id}`)} />
            ))}
          </div>
        </div>
      )}

      {portalSettings?.showInvoices && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Invoices</h2>
            {totalOutstanding > 0 && (
              <Badge variant="outline" className="text-chart-3 border-chart-3">
                <DollarSign className="h-3 w-3 mr-1" />
                ${totalOutstanding.toLocaleString()} outstanding
              </Badge>
            )}
          </div>
          {invoices && invoices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoices.slice(0, 6).map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} onView={() => setLocation(`/invoice/${invoice.id}`)} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet"
                  description="Your invoices will appear here once they are created"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {portalSettings?.showProjects && (!projects || projects.length === 0) && (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Your projects will appear here once they are created"
            />
          </CardContent>
        </Card>
      )}
      
      {!portalSettings?.showProjects && !portalSettings?.showInvoices && (
        <Card>
          <CardContent className="py-12 text-center">
            <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Welcome to your Portal</h3>
            <p className="text-sm text-muted-foreground">
              Your administrator is setting up your portal. Check back soon for updates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProjectCard({ project, onView }: { project: ProjectWithRelations; onView: () => void }) {
  const completedTasks = project.tasks?.filter((t) => t.status === "done").length || 0;
  const totalTasks = project.tasks?.length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Card className="hover-elevate" data-testid={`card-client-project-${project.id}`}>
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
              <span>{format(parseLocalDateFromISO(project.startDate)!, "MM/dd/yyyy")}</span>
            </div>
          )}
        </div>

        {totalTasks > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full mt-2" onClick={onView} data-testid={`button-view-project-${project.id}`}>
          View Details
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function InvoiceCard({ invoice, onView }: { invoice: InvoiceWithProject; onView: () => void }) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "paid":
        return { label: "Paid", variant: "default" as const, className: "bg-chart-2 text-white" };
      case "sent":
        return { label: "Awaiting Payment", variant: "outline" as const, className: "border-chart-3 text-chart-3" };
      case "cancelled":
        return { label: "Cancelled", variant: "secondary" as const, className: "" };
      default:
        return { label: "Draft", variant: "secondary" as const, className: "" };
    }
  };

  const statusInfo = getStatusInfo(invoice.status);

  return (
    <Card className="hover-elevate" data-testid={`card-client-invoice-${invoice.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-medium font-mono">{invoice.invoiceNumber}</p>
            {invoice.project && (
              <p className="text-sm text-muted-foreground truncate">
                {invoice.project.name}
              </p>
            )}
          </div>
          <Badge variant={statusInfo.variant} className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {invoice.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due {format(parseLocalDateFromISO(invoice.dueDate)!, "MM/dd/yyyy")}
              </span>
            )}
          </div>
          <p className="text-lg font-semibold">
            ${Number(invoice.total || 0).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onView} data-testid={`button-view-invoice-${invoice.id}`}>
          View Invoice
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function ClientProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: number; content: string; author: string } | null>(null);

  const { data: portalSettings } = useQuery<ClientPortalSettings>({
    queryKey: ["/api/client/portal-settings"],
  });

  const { data: project, isLoading } = useQuery<ProjectWithRelations>({
    queryKey: ["/api/client/projects", id],
    enabled: !!id,
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/client/projects", id, "documents"],
    enabled: !!id && !!portalSettings?.showDocuments,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/client/projects/${id}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/projects"] });
      setNewNote("");
      setReplyingTo(null);
      toast({ title: "Note added", description: "Your message has been sent" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const handleReply = (note: { id: number; content: string; user?: { firstName?: string | null } | null }) => {
    setReplyingTo({
      id: note.id,
      content: note.content.length > 100 ? note.content.slice(0, 100) + "..." : note.content,
      author: note.user?.firstName || "Team",
    });
  };

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

  const tasksByStatus = {
    pending: project.tasks?.filter(t => t.status === "todo" || t.status === "waiting") || [],
    inProgress: project.tasks?.filter(t => t.status === "in_progress") || [],
    completed: project.tasks?.filter(t => t.status === "done") || [],
  };

  const completedTasks = tasksByStatus.completed.length;
  const totalTasks = project.tasks?.length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Back to Projects
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-semibold text-foreground" data-testid="text-project-name">{project.name}</h1>
          <StatusBadge status={project.status} type="project" />
        </div>
        {project.address && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {project.address}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(progress)}%</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-3/10">
                <Timer className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasksByStatus.pending.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-4/10">
                <Clock className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasksByStatus.inProgress.length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-2/10">
                <CheckCircle2 className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasksByStatus.completed.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={portalSettings?.showTimeline ? "timeline" : portalSettings?.showMilestones ? "tasks" : portalSettings?.showDocuments ? "documents" : portalSettings?.showMessages ? "messages" : "timeline"}>
        <TabsList>
          {portalSettings?.showTimeline && (
            <TabsTrigger value="timeline" className="gap-2" data-testid="tab-timeline">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
          )}
          {portalSettings?.showMilestones && (
            <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
              <ClipboardList className="h-4 w-4" />
              Tasks ({project.tasks?.length || 0})
            </TabsTrigger>
          )}
          {portalSettings?.showDocuments && (
            <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
              <FileText className="h-4 w-4" />
              Documents ({documents?.length || 0})
            </TabsTrigger>
          )}
          {portalSettings?.showMessages && (
            <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
              <MessageSquare className="h-4 w-4" />
              Messages ({project.notes?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Timeline</CardTitle>
              <CardDescription>Track the progress of your permit</CardDescription>
            </CardHeader>
            <CardContent>
              {project.tasks && project.tasks.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {project.tasks.map((task, index) => (
                      <div key={task.id} className="relative flex gap-4 pl-10">
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-background ${
                          task.status === "done" ? "bg-chart-2" :
                          task.status === "in_progress" ? "bg-chart-4" :
                          task.status === "waiting" ? "bg-chart-3" :
                          "bg-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </span>
                            <StatusBadge status={task.status} type="task" />
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {format(parseLocalDateFromISO(task.dueDate)!, "MM/dd/yyyy")}
                              {isPast(parseLocalDateFromISO(task.dueDate)!) && task.status !== "done" && (
                                <Badge variant="destructive" className="ml-2">Overdue</Badge>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No timeline yet"
                  description="Tasks will appear here as they are created"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          {project.tasks && project.tasks.length > 0 ? (
            <div className="space-y-3">
              {project.tasks.map((task) => (
                <Card key={task.id} data-testid={`card-client-task-${task.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 mt-0.5 text-chart-2" />
                      ) : task.status === "waiting" ? (
                        <AlertCircle className="h-5 w-5 mt-0.5 text-chart-3" />
                      ) : task.status === "in_progress" ? (
                        <Clock className="h-5 w-5 mt-0.5 text-chart-4" />
                      ) : (
                        <Timer className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          {task.locationType && <TaskTypeBadge type={task.locationType} />}
                          <StatusBadge status={task.status} type="task" />
                          {task.requiresClientUpload && task.status !== "done" && (
                            <Badge variant="outline" className="border-chart-3 text-chart-3">
                              <Upload className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Due: {format(parseLocalDateFromISO(task.dueDate)!, "MM/dd/yyyy")}
                          </p>
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

        <TabsContent value="documents" className="mt-6">
          {documents && documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover-elevate" data-testid={`card-client-document-${doc.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.createdAt && format(new Date(doc.createdAt), "MM/dd/yyyy")}
                          {doc.category && ` - ${doc.category}`}
                        </p>
                      </div>
                      {doc.storagePath && (
                        <Button variant="outline" size="sm" asChild data-testid={`button-download-document-${doc.id}`}>
                          <a href={doc.storagePath} target="_blank" rel="noopener noreferrer" download={doc.fileName}>
                            Download
                          </a>
                        </Button>
                      )}
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
                  title="No documents yet"
                  description="Documents shared with you will appear here"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message Thread</CardTitle>
              <CardDescription>Communicate with your permit team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.notes && project.notes.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-auto">
                  {project.notes.map((note) => (
                    <div
                      key={note.id}
                      className="group p-3 rounded-md bg-muted/50"
                      data-testid={`card-client-note-${note.id}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{note.user?.firstName || "Team"}</span>
                          <span>-</span>
                          <span>{note.createdAt && formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleReply(note)}
                          data-testid={`button-reply-${note.id}`}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
              )}

              {replyingTo && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-primary/10 border-l-2 border-primary">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Replying to {replyingTo.author}</p>
                    <p className="text-sm truncate">{replyingTo.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setReplyingTo(null)}
                    data-testid="button-cancel-reply"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  placeholder={replyingTo ? `Reply to ${replyingTo.author}...` : "Type your message..."}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-client-message"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (newNote.trim()) {
                      const messageContent = replyingTo
                        ? `> ${replyingTo.author}: "${replyingTo.content}"\n\n${newNote.trim()}`
                        : newNote.trim();
                      addNoteMutation.mutate(messageContent);
                    }
                  }}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {addNoteMutation.isPending ? "Sending..." : replyingTo ? "Send Reply" : "Send Message"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Client Invoice Detail Component
interface InvoiceWithDetails {
  id: number;
  invoiceNumber: string;
  clientId: number;
  projectId: number | null;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  notes: string | null;
  project: Project | null;
  client: Client;
  items: InvoiceItem[];
}

interface InvoiceItem {
  id: number;
  description: string | null;
  quantity: string | null;
  rate: string | null;
  amount: string | null;
}

export function ClientInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: invoice, isLoading, error } = useQuery<InvoiceWithDetails>({
    queryKey: ["/api/client/invoices", id],
    enabled: !!id,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-to-portal">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
        <Card data-testid="card-invoice-not-found">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-1" data-testid="text-invoice-not-found-title">Invoice Not Found</p>
            <p className="text-sm" data-testid="text-invoice-not-found-message">This invoice may not be available or access is restricted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "paid":
        return { label: "Paid", variant: "default" as const, className: "bg-chart-2 text-white" };
      case "sent":
        return { label: "Awaiting Payment", variant: "outline" as const, className: "border-chart-3 text-chart-3" };
      case "cancelled":
        return { label: "Cancelled", variant: "secondary" as const, className: "" };
      default:
        return { label: "Draft", variant: "secondary" as const, className: "" };
    }
  };

  const statusInfo = getStatusInfo(invoice.status);

  return (
    <div className="space-y-6" data-testid="client-invoice-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-to-portal">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono" data-testid="text-invoice-number">{invoice.invoiceNumber}</h1>
          {invoice.project && (
            <p className="text-muted-foreground" data-testid="text-invoice-project">{invoice.project.name}</p>
          )}
        </div>
        <Badge variant={statusInfo.variant} className={statusInfo.className} data-testid="badge-invoice-status">
          {statusInfo.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-issue-date">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issue Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium" data-testid="text-issue-date">
              {invoice.issueDate ? format(parseLocalDateFromISO(invoice.issueDate)!, "MMMM d, yyyy") : "-"}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-due-date">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium" data-testid="text-due-date">
              {invoice.dueDate ? format(parseLocalDateFromISO(invoice.dueDate)!, "MMMM d, yyyy") : "-"}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-amount">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-amount">
              ${Number(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-invoice-items">
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.items && invoice.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-invoice-items">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Description</th>
                    <th className="text-right py-3 px-2 font-medium">Qty</th>
                    <th className="text-right py-3 px-2 font-medium">Rate</th>
                    <th className="text-right py-3 px-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0" data-testid={`row-invoice-item-${item.id}`}>
                      <td className="py-3 px-2" data-testid={`text-item-description-${item.id}`}>{item.description || "-"}</td>
                      <td className="text-right py-3 px-2" data-testid={`text-item-quantity-${item.id}`}>{item.quantity || "-"}</td>
                      <td className="text-right py-3 px-2" data-testid={`text-item-rate-${item.id}`}>
                        {item.rate ? `$${Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="text-right py-3 px-2 font-medium" data-testid={`text-item-amount-${item.id}`}>
                        ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="text-right py-3 px-2 font-medium">Subtotal</td>
                    <td className="text-right py-3 px-2 font-medium" data-testid="text-subtotal">
                      ${Number(invoice.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {invoice.tax && Number(invoice.tax) > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right py-2 px-2 text-muted-foreground">Tax</td>
                      <td className="text-right py-2 px-2 text-muted-foreground" data-testid="text-tax">
                        ${Number(invoice.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  <tr className="text-lg">
                    <td colSpan={3} className="text-right py-3 px-2 font-bold">Total</td>
                    <td className="text-right py-3 px-2 font-bold" data-testid="text-invoice-total">
                      ${Number(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-invoice-items">No items on this invoice</p>
          )}
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card data-testid="card-invoice-notes">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap" data-testid="text-invoice-notes">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
