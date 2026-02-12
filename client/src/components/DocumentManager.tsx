import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  FolderPlus,
  FolderOpen,
  File,
  Upload,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Loader2,
  X,
  EyeOff,
} from "lucide-react";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Folder as FolderType, Document as DocumentType } from "@shared/schema";

interface DocumentManagerProps {
  entityType: "project" | "associate";
  entityId: number;
  folders: FolderType[];
  documents: DocumentType[];
  showCategorySelector?: boolean;
  showVisibilitySelector?: boolean;
  onRefresh: () => void;
}

const categoryOptions = [
  { value: "plan", label: "Plan" },
  { value: "permit", label: "Permit" },
  { value: "survey", label: "Survey" },
  { value: "dob_letter", label: "DOB Letter" },
  { value: "correspondence", label: "Correspondence" },
  { value: "legal", label: "Legal" },
  { value: "photo", label: "Photo" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
];

function getFilePreviewType(doc: DocumentType): "pdf" | "image" | "other" {
  const ext = (doc.storagePath || "").split(".").pop()?.toLowerCase() || "";
  const fileType = (doc.fileType || "").toLowerCase();
  if (fileType.includes("pdf") || ext === "pdf") return "pdf";
  if (
    fileType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
  )
    return "image";
  return "other";
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentManager({
  entityType,
  entityId,
  folders,
  documents,
  showCategorySelector = false,
  showVisibilitySelector = false,
  onRefresh,
}: DocumentManagerProps) {
  const { toast } = useToast();
  const basePath = `/api/${entityType}s/${entityId}`;

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [viewingDocument, setViewingDocument] = useState<DocumentType | null>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const [deletingFolder, setDeletingFolder] = useState<FolderType | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<DocumentType | null>(null);

  const [movingDocument, setMovingDocument] = useState<DocumentType | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>("__none__");

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState<string>("__none__");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadVisible, setUploadVisible] = useState(true);
  const [uploadedStoragePath, setUploadedStoragePath] = useState("");
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState("");
  const [isUploadComplete, setIsUploadComplete] = useState(false);
  const pendingUploadRef = useRef<{ path: string; size: number | null; type: string }>({ path: "", size: null, type: "" });

  const [bulkUploadCategory, setBulkUploadCategory] = useState("other");
  const [bulkUploadVisible, setBulkUploadVisible] = useState(true);
  const bulkUploadPathsRef = useRef<Map<string, { storagePath: string; fileSize: number | null; fileName: string }>>(new Map());

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `${basePath}/folders`, { name });
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
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
      onRefresh();
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
      onRefresh();
      if (deletingFolder && selectedFolderId === deletingFolder.id) {
        setSelectedFolderId(null);
      }
      setDeletingFolder(null);
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
      onRefresh();
      setDeletingDocument(null);
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const moveDocumentMutation = useMutation({
    mutationFn: async ({ docId, folderId }: { docId: number; folderId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/documents/${docId}`, { folderId });
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      setMovingDocument(null);
      toast({ title: "Document moved" });
    },
    onError: () => {
      toast({ title: "Failed to move document", variant: "destructive" });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ docId, isVisibleToClient }: { docId: number; isVisibleToClient: boolean }) => {
      const res = await apiRequest("PATCH", `/api/documents/${docId}`, { isVisibleToClient });
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      toast({ title: "Visibility updated" });
    },
    onError: () => {
      toast({ title: "Failed to update visibility", variant: "destructive" });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: {
      fileName: string;
      storagePath: string;
      fileType: string;
      fileSize: number | null;
      folderId: number | null;
      category: string;
      isVisibleToClient: boolean;
    }) => {
      const res = await apiRequest("POST", `${basePath}/documents`, data);
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      resetUploadDialog();
      toast({ title: "Document uploaded" });
    },
    onError: () => {
      toast({ title: "Failed to save document", variant: "destructive" });
    },
  });

  const resetUploadDialog = () => {
    setShowUploadDialog(false);
    setUploadDocName("");
    setUploadFolderId(selectedFolderId?.toString() || "__none__");
    setUploadCategory("other");
    setUploadVisible(true);
    setUploadedStoragePath("");
    setUploadedFileSize(null);
    setUploadedFileType("");
    setIsUploadComplete(false);
    pendingUploadRef.current = { path: "", size: null, type: "" };
  };

  const handleOpenUploadDialog = () => {
    setUploadFolderId(selectedFolderId?.toString() || "__none__");
    setUploadDocName("");
    setUploadCategory("other");
    setUploadVisible(true);
    setUploadedStoragePath("");
    setUploadedFileSize(null);
    setUploadedFileType("");
    setIsUploadComplete(false);
    pendingUploadRef.current = { path: "", size: null, type: "" };
    setShowUploadDialog(true);
  };

  const handleSaveDocument = () => {
    if (!uploadDocName.trim() || !uploadedStoragePath) return;
    createDocumentMutation.mutate({
      fileName: uploadDocName.trim(),
      storagePath: uploadedStoragePath,
      fileType: uploadedFileType,
      fileSize: uploadedFileSize,
      folderId: uploadFolderId === "__none__" ? null : parseInt(uploadFolderId),
      category: uploadCategory,
      isVisibleToClient: uploadVisible,
    });
  };

  const filteredDocuments = selectedFolderId
    ? documents.filter((d) => d.folderId === selectedFolderId)
    : documents;

  const previewType = viewingDocument ? getFilePreviewType(viewingDocument) : "other";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={selectedFolderId === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFolderId(null)}
            data-testid="button-all-folders"
          >
            All Folders
          </Button>
          {folders.map((folder) => (
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolderDialog(true)}
            data-testid="button-new-folder"
          >
            <FolderPlus className="h-4 w-4 mr-1.5" />
            New Folder
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenUploadDialog}
            data-testid="button-upload-file"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Upload File
          </Button>
          <ObjectUploader
            maxNumberOfFiles={20}
            autoProceed={false}
            showStagingStep={true}
            folders={folders.map((f) => ({ id: f.id, name: f.name }))}
            defaultFolderId={selectedFolderId?.toString() || "__none__"}
            defaultCategory={bulkUploadCategory}
            defaultVisibility={bulkUploadVisible}
            showCategorySelector={showCategorySelector}
            showVisibilitySelector={showVisibilitySelector}
            onCategoryChange={setBulkUploadCategory}
            onVisibilityChange={setBulkUploadVisible}
            onGetUploadParameters={async (file) => {
              const fileId = file?.id || "";
              const fileName = file?.name || "";
              const fileType = file?.type || "application/octet-stream";
              const res = await fetch(`${basePath}/documents/upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ category: bulkUploadCategory, fileSize: file?.size || 0 }),
              });
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                if (errorData.code === "STORAGE_LIMIT_EXCEEDED") {
                  const error: any = new Error("Storage limit exceeded");
                  error.code = "STORAGE_LIMIT_EXCEEDED";
                  throw error;
                }
                throw new Error("Failed to get upload URL");
              }
              const data = await res.json();
              bulkUploadPathsRef.current.set(fileId, {
                storagePath: data.objectPath,
                fileSize: file?.size || null,
                fileName,
              });
              return {
                method: "PUT" as const,
                url: data.uploadUrl,
                headers: { "Content-Type": fileType },
              };
            }}
            onComplete={async (result, stagedFilesConfig, settings) => {
              if (result.successful && result.successful.length > 0) {
                try {
                  const category = settings?.category || bulkUploadCategory;
                  const visibility = settings?.visibility ?? bulkUploadVisible;
                  let successCount = 0;
                  let errorCount = 0;

                  for (const uploadedFile of result.successful) {
                    const fileId = uploadedFile.id || "";
                    const uploadInfo = bulkUploadPathsRef.current.get(fileId);
                    const fileConfig = stagedFilesConfig?.get(fileId);

                    if (uploadInfo?.storagePath) {
                      try {
                        const documentName =
                          fileConfig?.documentName || uploadInfo.fileName || uploadedFile.name || `document-${successCount + 1}`;
                        const folderId = fileConfig?.folderId ? parseInt(fileConfig.folderId) : null;

                        await apiRequest("POST", `${basePath}/documents`, {
                          fileName: documentName,
                          storagePath: uploadInfo.storagePath,
                          fileSize: uploadInfo.fileSize,
                          category,
                          folderId,
                          isVisibleToClient: visibility,
                        });
                        successCount++;
                      } catch {
                        errorCount++;
                      }
                    } else {
                      errorCount++;
                    }
                  }

                  onRefresh();

                  if (successCount > 0) {
                    toast({
                      title: `${successCount} document${successCount > 1 ? "s" : ""} uploaded successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
                    });
                  } else if (errorCount > 0) {
                    toast({
                      title: "Upload failed",
                      description: "Failed to save document records",
                      variant: "destructive",
                    });
                  }

                  bulkUploadPathsRef.current.clear();
                  setBulkUploadCategory("other");
                  setBulkUploadVisible(true);
                } catch {
                  toast({ title: "Upload error", variant: "destructive" });
                }
              }
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </ObjectUploader>
        </div>
      </div>

      {selectedFolderId && (
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            {folders.find((f) => f.id === selectedFolderId)?.name}
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
                  const folder = folders.find((f) => f.id === selectedFolderId);
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
                  const folder = folders.find((f) => f.id === selectedFolderId);
                  if (folder) setDeletingFolder(folder);
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

      {filteredDocuments.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} data-testid={`document-item-${doc.id}`}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-6 w-6 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`text-document-name-${doc.id}`}>
                      {doc.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {showCategorySelector && doc.category && doc.category !== "other" && (
                        <Badge variant="secondary" className="text-xs">
                          {categoryOptions.find((c) => c.value === doc.category)?.label || doc.category}
                        </Badge>
                      )}
                      {doc.folderId && (
                        <span>
                          {folders.find((f) => f.id === doc.folderId)?.name}
                        </span>
                      )}
                      {doc.fileSize ? <span>{formatFileSize(doc.fileSize)}</span> : null}
                      {showVisibilitySelector && (
                        <span className="flex items-center gap-0.5">
                          {doc.isVisibleToClient ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewingDocument(doc)}
                    data-testid={`button-view-document-${doc.id}`}
                  >
                    <Eye className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                  <Button size="sm" variant="ghost" asChild data-testid={`button-download-document-${doc.id}`}>
                    <a href={doc.storagePath} download={doc.fileName}>
                      <Download className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-document-actions-${doc.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setMovingDocument(doc);
                          setMoveTargetFolderId(doc.folderId?.toString() || "__none__");
                        }}
                        data-testid={`button-move-document-${doc.id}`}
                      >
                        <FolderInput className="h-4 w-4 mr-2" />
                        Move to Folder
                      </DropdownMenuItem>
                      {showVisibilitySelector && (
                        <DropdownMenuItem
                          onClick={() =>
                            toggleVisibilityMutation.mutate({
                              docId: doc.id,
                              isVisibleToClient: !doc.isVisibleToClient,
                            })
                          }
                          data-testid={`button-toggle-visibility-${doc.id}`}
                        >
                          {doc.isVisibleToClient ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Hide from Client
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Show to Client
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingDocument(doc)}
                        data-testid={`button-delete-document-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <File className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm" data-testid="text-no-documents">
              {selectedFolderId ? "No documents in this folder" : "No documents yet"}
            </p>
            <p className="text-muted-foreground text-xs mt-1">Upload files to get started</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={viewingDocument !== null} onOpenChange={(open) => { if (!open) setViewingDocument(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle data-testid="text-viewer-title">{viewingDocument?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {viewingDocument && previewType === "pdf" && (
              <iframe
                src={`${viewingDocument.storagePath}?inline=true`}
                className="w-full h-[70vh]"
                title={viewingDocument.fileName}
                data-testid="viewer-pdf"
              />
            )}
            {viewingDocument && previewType === "image" && (
              <img
                src={`${viewingDocument.storagePath}?inline=true`}
                className="max-w-full max-h-[70vh] object-contain mx-auto"
                alt={viewingDocument.fileName}
                data-testid="viewer-image"
              />
            )}
            {viewingDocument && previewType === "other" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4" data-testid="viewer-other">
                <File className="h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">Preview not available for this file type</p>
                <Button asChild>
                  <a href={viewingDocument.storagePath} download={viewingDocument.fileName} data-testid="button-viewer-download-fallback">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </a>
                </Button>
              </div>
            )}
          </div>
          {viewingDocument && (
            <DialogFooter>
              <Button asChild data-testid="button-viewer-download">
                <a href={viewingDocument.storagePath} download={viewingDocument.fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) resetUploadDialog(); }}>
        <DialogContent className="max-w-md z-[150]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!isUploadComplete ? (
              <div>
                <label className="text-sm font-medium mb-2 block">Select File</label>
                <SimpleFileUploader
                  onGetUploadParameters={async (file) => {
                    const fileType = file?.type || "application/octet-stream";
                    const res = await fetch(`${basePath}/documents/upload`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ category: uploadCategory, fileSize: file?.size || 0 }),
                    });
                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({}));
                      if (errorData.code === "STORAGE_LIMIT_EXCEEDED") {
                        const error: any = new Error("Storage limit exceeded");
                        error.code = "STORAGE_LIMIT_EXCEEDED";
                        throw error;
                      }
                      throw new Error("Failed to get upload URL");
                    }
                    const data = await res.json();
                    pendingUploadRef.current = { path: data.objectPath, size: file?.size || null, type: fileType };
                    return {
                      method: "PUT" as const,
                      url: data.uploadUrl,
                      headers: { "Content-Type": fileType },
                    };
                  }}
                  onUploadComplete={(file) => {
                    const { path, size, type } = pendingUploadRef.current;
                    if (path) {
                      setUploadedStoragePath(path);
                      setUploadedFileSize(size);
                      setUploadedFileType(type);
                      setIsUploadComplete(true);
                      const nameFromFile = file.name.replace(/\.[^/.]+$/, "");
                      if (!uploadDocName) {
                        const selectedFolder = folders.find((f) => f.id === selectedFolderId);
                        setUploadDocName(selectedFolder ? selectedFolder.name : nameFromFile);
                      }
                    }
                  }}
                  buttonClassName="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </SimpleFileUploader>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <File className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">File uploaded successfully</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsUploadComplete(false);
                      setUploadedStoragePath("");
                      setUploadedFileSize(null);
                      setUploadedFileType("");
                      pendingUploadRef.current = { path: "", size: null, type: "" };
                    }}
                    data-testid="button-remove-upload"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Document Name</label>
                  <Input
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    placeholder="Enter document name"
                    data-testid="input-upload-doc-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Folder</label>
                  <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                    <SelectTrigger data-testid="select-upload-folder">
                      <SelectValue placeholder="No folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No folder</SelectItem>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id.toString()}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showCategorySelector && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger data-testid="select-upload-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showVisibilitySelector && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="upload-visible"
                      checked={uploadVisible}
                      onCheckedChange={(checked) => setUploadVisible(!!checked)}
                      data-testid="checkbox-upload-visible"
                    />
                    <label htmlFor="upload-visible" className="text-sm">
                      Visible to client
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetUploadDialog} data-testid="button-cancel-upload">
              Cancel
            </Button>
            <Button
              onClick={handleSaveDocument}
              disabled={!isUploadComplete || !uploadDocName.trim() || createDocumentMutation.isPending}
              data-testid="button-save-document"
            >
              {createDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <DialogFooter className="gap-2">
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
          <DialogFooter className="gap-2">
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

      <AlertDialog open={!!deletingFolder} onOpenChange={(open) => { if (!open) setDeletingFolder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder "{deletingFolder?.name}"? Documents inside will be moved to no folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-folder">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFolder) deleteFolderMutation.mutate(deletingFolder.id);
              }}
              className="bg-destructive text-destructive-foreground border-destructive-border"
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingDocument} onOpenChange={(open) => { if (!open) setDeletingDocument(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDocument?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-document">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingDocument) deleteDocumentMutation.mutate(deletingDocument.id);
              }}
              className="bg-destructive text-destructive-foreground border-destructive-border"
              data-testid="button-confirm-delete-document"
            >
              {deleteDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!movingDocument} onOpenChange={(open) => { if (!open) setMovingDocument(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Folder</label>
            <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
              <SelectTrigger data-testid="select-move-folder">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No folder</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMovingDocument(null)} data-testid="button-cancel-move">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (movingDocument) {
                  moveDocumentMutation.mutate({
                    docId: movingDocument.id,
                    folderId: moveTargetFolderId === "__none__" ? null : parseInt(moveTargetFolderId),
                  });
                }
              }}
              disabled={moveDocumentMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
