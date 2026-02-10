import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  FolderKanban,
  CheckSquare,
  Calendar,
  MapPin,
  AlertCircle,
  FolderPlus,
  Folder,
  File,
  Upload,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Pencil,
  Loader2,
} from "lucide-react";
import { AssociateTypeBadge, StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Associate, Project, Task, Folder as FolderType, Document as DocumentType } from "@shared/schema";
import { isDateOverdue, formatLocalDate } from "@/lib/dateUtils";

interface AssociateWithRelations extends Associate {
  projects: Project[];
  tasks: (Task & { project?: Project })[];
}

export default function AssociateDetail() {
  const { id } = useParams<{ id: string }>();
  const associateId = parseInt(id || "0");
  const { toast } = useToast();

  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const lastUploadPathRef = useRef("");

  const { data: associate, isLoading } = useQuery<AssociateWithRelations>({
    queryKey: ["/api/associates", associateId, "full"],
    enabled: !!associateId,
  });

  const { data: folders } = useQuery<FolderType[]>({
    queryKey: ["/api/associates", associateId, "folders"],
    enabled: !!associateId,
  });

  const { data: documents } = useQuery<DocumentType[]>({
    queryKey: ["/api/associates", associateId, "documents"],
    enabled: !!associateId,
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/associates/${associateId}/folders`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "folders"] });
      setShowNewFolderDialog(false);
      setNewFolderName("");
      toast({ title: "Folder created" });
    },
    onError: () => {
      toast({ title: "Failed to create folder", variant: "destructive" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/folders/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "folders"] });
      setEditingFolder(null);
      toast({ title: "Folder renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename folder", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      await apiRequest("DELETE", `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "documents"] });
      if (selectedFolderId) setSelectedFolderId(null);
      toast({ title: "Folder deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete folder", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const handleUploadComplete = async (file: File, storagePath: string) => {
    try {
      await apiRequest("POST", `/api/associates/${associateId}/documents`, {
        fileName: file.name,
        storagePath,
        fileType: file.type,
        fileSize: file.size,
        folderId: selectedFolderId,
        category: "other",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/associates", associateId, "documents"] });
      toast({ title: "Document uploaded" });
    } catch {
      toast({ title: "Failed to save document record", variant: "destructive" });
    }
  };

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

  const filteredDocuments = selectedFolderId
    ? documents?.filter(d => d.folderId === selectedFolderId)
    : documents;

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
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-associate-sections">
              <TabsTrigger value="tasks" data-testid="tab-tasks">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tasks ({associate.tasks?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="projects" data-testid="tab-projects">
                <FolderKanban className="h-4 w-4 mr-2" />
                Projects ({linkedProjects.length})
              </TabsTrigger>
              <TabsTrigger value="folders" data-testid="tab-folders">
                <Folder className="h-4 w-4 mr-2" />
                Folders
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
                            {project.address && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {project.address}
                              </p>
                            )}
                          </div>
                          {project.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatLocalDate(project.createdAt)}
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

            <TabsContent value="folders" className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={selectedFolderId === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFolderId(null)}
                    data-testid="button-all-documents"
                  >
                    All Documents
                  </Button>
                  {folders?.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={selectedFolderId === folder.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFolderId(folder.id)}
                      data-testid={`button-folder-${folder.id}`}
                    >
                      <Folder className="h-3.5 w-3.5 mr-1.5" />
                      {folder.name}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFolderDialog(true)}
                    data-testid="button-new-folder"
                  >
                    <FolderPlus className="h-4 w-4 mr-1.5" />
                    New Folder
                  </Button>
                  <SimpleFileUploader
                    onGetUploadParameters={async (file) => {
                      const res = await fetch(`/api/associates/${associateId}/documents/upload`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          fileName: "upload",
                          fileSize: file.size,
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        if (err.code === "STORAGE_LIMIT_EXCEEDED") {
                          const error: any = new Error("Storage limit exceeded");
                          error.code = "STORAGE_LIMIT_EXCEEDED";
                          throw error;
                        }
                        throw new Error("Failed to get upload URL");
                      }
                      const data = await res.json();
                      lastUploadPathRef.current = data.objectPath;
                      return { method: "PUT" as const, url: data.uploadUrl };
                    }}
                    onUploadComplete={async (file) => {
                      const storagePath = lastUploadPathRef.current;
                      if (storagePath) {
                        await handleUploadComplete(file, storagePath);
                        lastUploadPathRef.current = "";
                      }
                    }}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Upload File
                  </SimpleFileUploader>
                </div>
              </div>

              {selectedFolderId && (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Folder: {folders?.find(f => f.id === selectedFolderId)?.name}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid="button-folder-actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => {
                          const folder = folders?.find(f => f.id === selectedFolderId);
                          if (folder) {
                            setEditingFolder(folder);
                            setEditFolderName(folder.name);
                          }
                        }}
                        data-testid="button-rename-folder"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (selectedFolderId) deleteFolderMutation.mutate(selectedFolderId);
                        }}
                        data-testid="button-delete-folder"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {filteredDocuments && filteredDocuments.length > 0 ? (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => (
                    <Card key={doc.id} data-testid={`document-item-${doc.id}`}>
                      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="h-6 w-6 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" data-testid={`text-document-name-${doc.id}`}>{doc.fileName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {doc.fileSize && (
                                <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                              )}
                              {doc.folderId && folders && (
                                <span>in {folders.find(f => f.id === doc.folderId)?.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" asChild data-testid={`button-view-document-${doc.id}`}>
                            <a href={`${doc.storagePath}?inline=true`} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" asChild data-testid={`button-download-document-${doc.id}`}>
                            <a href={doc.storagePath} download={doc.fileName}>
                              <Download className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Download</span>
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteDocumentMutation.mutate(doc.id)}
                            data-testid={`button-delete-document-${doc.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <File className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {selectedFolderId ? "No documents in this folder" : "No documents yet"}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">Upload files to get started</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                createFolderMutation.mutate(newFolderName.trim());
              }
            }}
            data-testid="input-folder-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} data-testid="button-cancel-folder">
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate(newFolderName.trim())}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-create-folder"
            >
              {createFolderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFolder} onOpenChange={(open) => { if (!open) setEditingFolder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={editFolderName}
            onChange={(e) => setEditFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editFolderName.trim() && editingFolder) {
                updateFolderMutation.mutate({ id: editingFolder.id, name: editFolderName.trim() });
              }
            }}
            data-testid="input-rename-folder"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)} data-testid="button-cancel-rename">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingFolder) {
                  updateFolderMutation.mutate({ id: editingFolder.id, name: editFolderName.trim() });
                }
              }}
              disabled={!editFolderName.trim() || updateFolderMutation.isPending}
              data-testid="button-save-rename"
            >
              {updateFolderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({ task }: { task: Task & { project?: Project } }) {
  const isOverdue = task.status !== "done" && task.status !== "cancelled" && isDateOverdue(task.dueDate);

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
                  {formatLocalDate(task.dueDate)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
