import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Timer,
  Clock,
  FileText,
  Send,
  Reply,
  X,
  Download,
  Users,
  Archive,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Client, Task, Note, User, Document, ClientPortalSettings, Associate } from "@shared/schema";
import { formatLocalDate } from "@/lib/dateUtils";

type TaskWithSubtasks = Task & {
  subtasks?: TaskWithSubtasks[];
  assignee?: User;
  relatedAssociate?: Associate;
};

type ProjectWithRelations = Project & {
  client: Client;
  tasks: TaskWithSubtasks[];
  notes: (Note & { user: User })[];
};

function ReadOnlyTaskItem({
  task,
  level = 0,
  expandedTasks,
  toggleExpand,
}: {
  task: TaskWithSubtasks;
  level?: number;
  expandedTasks: Set<number>;
  toggleExpand: (taskId: number) => void;
}) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);

  return (
    <div className="space-y-2">
      <div
        className={`flex items-start gap-3 p-4 rounded-lg border bg-card ${level > 0 ? 'ml-6 border-l-2 border-l-muted' : ''}`}
        data-testid={`task-item-${task.id}`}
      >
        <div className="flex items-center gap-2">
          {hasSubtasks && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleExpand(task.id)}
              data-testid={`button-expand-task-${task.id}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
            <Badge variant="outline" size="sm">{task.type.replace(/_/g, ' ')}</Badge>
            <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'} size="sm">
              {task.priority}
            </Badge>
            <StatusBadge status={task.status} type="task" />
            {hasSubtasks && (
              <Badge variant="outline">
                {task.subtasks?.filter(s => s.status === 'done').length}/{task.subtasks?.length} subtasks
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            {task.assignee && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.assignee.firstName || task.assignee.email}
              </span>
            )}
            {task.relatedAssociate && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.relatedAssociate.name}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatLocalDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
      {hasSubtasks && isExpanded && (
        <div className="space-y-2">
          {task.subtasks?.map((subtask) => (
            <ReadOnlyTaskItem
              key={subtask.id}
              task={subtask}
              level={level + 1}
              expandedTasks={expandedTasks}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: number; content: string; author: string } | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);

  const toggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

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

  const buildTaskHierarchy = (tasks: TaskWithSubtasks[]): TaskWithSubtasks[] => {
    const taskMap = new Map<number, TaskWithSubtasks>();
    const rootTasks: TaskWithSubtasks[] = [];

    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    tasks.forEach(task => {
      const taskWithSubtasks = taskMap.get(task.id)!;
      if (task.parentTaskId) {
        const parent = taskMap.get(task.parentTaskId);
        if (parent) {
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(taskWithSubtasks);
        } else {
          rootTasks.push(taskWithSubtasks);
        }
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });

    return rootTasks;
  };

  const hasIncompleteSubtasks = (task: TaskWithSubtasks): boolean => {
    if (!task.subtasks || task.subtasks.length === 0) return false;
    return task.subtasks.some(subtask =>
      (subtask.status !== 'done' && subtask.status !== 'cancelled') || hasIncompleteSubtasks(subtask)
    );
  };

  const filterActiveTasks = (tasks: TaskWithSubtasks[]): TaskWithSubtasks[] => {
    return tasks.filter(task => {
      const isIncomplete = task.status !== 'done' && task.status !== 'cancelled';
      const hasActiveSubtasks = hasIncompleteSubtasks(task);
      return isIncomplete || hasActiveSubtasks;
    }).map(task => ({
      ...task,
      subtasks: task.subtasks ? filterActiveTasks(task.subtasks) : []
    }));
  };

  const filterArchivedTasks = (tasks: TaskWithSubtasks[]): TaskWithSubtasks[] => {
    return tasks.filter(task => {
      const isComplete = task.status === 'done' || task.status === 'cancelled';
      const hasActiveSubtasks = hasIncompleteSubtasks(task);
      return isComplete && !hasActiveSubtasks;
    });
  };

  const hierarchicalTasks = buildTaskHierarchy(project.tasks || []);
  const activeTasks = filterActiveTasks(hierarchicalTasks);
  const archivedTasks = filterArchivedTasks(hierarchicalTasks);

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
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" data-testid="link-back-to-projects">
          <ChevronLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 mt-2 flex-wrap">
          <h1 className="text-xl sm:text-3xl font-semibold text-foreground break-words" data-testid="text-project-name">{project.name}</h1>
          <StatusBadge status={project.status} type="project" />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <p className="text-sm sm:text-base text-muted-foreground">
            {project.client?.name}
          </p>
        </div>
        {project.address && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {project.address}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
        {project.municipality && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Municipality</p>
                <p className="text-sm font-medium">{project.municipality}</p>
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
                  {formatLocalDate(project.startDate)}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-progress-percent">{Math.round(progress)}%</p>
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
                <p className="text-2xl font-bold" data-testid="text-pending-count">{tasksByStatus.pending.length}</p>
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
                <p className="text-2xl font-bold" data-testid="text-inprogress-count">{tasksByStatus.inProgress.length}</p>
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
                <p className="text-2xl font-bold" data-testid="text-completed-count">{tasksByStatus.completed.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={portalSettings?.showMilestones ? "tasks" : portalSettings?.showDocuments ? "documents" : portalSettings?.showMessages ? "messages" : portalSettings?.showTimeline ? "timeline" : "tasks"}>
        <TabsList>
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
          {portalSettings?.showTimeline && (
            <TabsTrigger value="timeline" className="gap-2" data-testid="tab-timeline">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          {activeTasks.length > 0 ? (
            <div className="space-y-4">
              {activeTasks.map((task) => (
                <ReadOnlyTaskItem
                  key={task.id}
                  task={task}
                  expandedTasks={expandedTasks}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={ClipboardList}
                  title="No open tasks"
                  description={archivedTasks.length > 0 ? "All tasks are completed. View archived tasks below." : "Tasks will appear here as they are created"}
                />
              </CardContent>
            </Card>
          )}

          {archivedTasks.length > 0 && (
            <div className="mt-6">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground mb-3"
                onClick={() => setShowArchivedTasks(!showArchivedTasks)}
                data-testid="button-toggle-archived-tasks"
              >
                <Archive className="h-4 w-4 mr-2" />
                {showArchivedTasks ? "Hide" : "View"} Archived Tasks ({archivedTasks.length})
                {showArchivedTasks ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
              {showArchivedTasks && (
                <div className="space-y-4 opacity-75">
                  {archivedTasks.map((task) => (
                    <ReadOnlyTaskItem
                      key={task.id}
                      task={task}
                      expandedTasks={expandedTasks}
                      toggleExpand={toggleExpand}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          {documents && documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {doc.category?.replace(/_/g, " ") || "Document"}
                        </p>
                        {doc.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatLocalDate(doc.createdAt)}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.storagePath} target="_blank" rel="noopener noreferrer" data-testid={`button-download-doc-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
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
                  description="Documents will appear here as they are uploaded"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Messages</CardTitle>
              <CardDescription>Communication with the project team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.notes && project.notes.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {project.notes.filter(n => n.isVisibleToClient).map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-lg bg-muted/50"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {note.user?.firstName || "Team"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReply(note)}
                          data-testid={`button-reply-${note.id}`}
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm mt-1">{note.content}</p>
                      {note.createdAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatLocalDate(note.createdAt)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet
                </p>
              )}

              {portalSettings?.showMessages && (
                <div className="space-y-2 pt-4 border-t">
                  {replyingTo && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
                      <Reply className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Replying to {replyingTo.author}: "{replyingTo.content}"
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        onClick={() => setReplyingTo(null)}
                        data-testid="button-cancel-reply"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="flex-1"
                      data-testid="textarea-new-message"
                    />
                    <Button
                      onClick={() => {
                        if (newNote.trim()) {
                          const content = replyingTo
                            ? `Re: ${replyingTo.author}\n\n${newNote}`
                            : newNote;
                          addNoteMutation.mutate(content);
                        }
                      }}
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                    {project.tasks.map((task) => (
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
                              Due: {formatLocalDate(task.dueDate)}
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
      </Tabs>
    </div>
  );
}
