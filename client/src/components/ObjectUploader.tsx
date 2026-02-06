import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult, UppyFile } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Mail, Phone, File, X, ChevronLeft, Upload, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

interface FolderOption {
  id: number;
  name: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface StagedFile {
  id: string;
  name: string;
  size: number;
  type?: string;
  documentName: string;
  folderId: string;
  uppyFile: UppyFile<Record<string, unknown>, Record<string, unknown>>;
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  autoProceed?: boolean;
  showStagingStep?: boolean;
  folders?: FolderOption[];
  categories?: CategoryOption[];
  defaultFolderId?: string;
  defaultCategory?: string;
  defaultVisibility?: boolean;
  showCategorySelector?: boolean;
  showVisibilitySelector?: boolean;
  onCategoryChange?: (category: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onGetUploadParameters: (file?: { id: string; name: string; size: number; type?: string }) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>,
    stagedFiles?: Map<string, { documentName: string; folderId: string | null }>,
    settings?: { category: string; visibility: boolean }
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

const defaultCategories: CategoryOption[] = [
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

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 52428800,
  autoProceed = false,
  showStagingStep = true,
  folders = [],
  categories = defaultCategories,
  defaultFolderId = "__none__",
  defaultCategory = "other",
  defaultVisibility = true,
  showCategorySelector = true,
  showVisibilitySelector = true,
  onCategoryChange,
  onVisibilityChange,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLimitExceeded, setShowLimitExceeded] = useState(false);
  const [dashboardElement, setDashboardElement] = useState<HTMLDivElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [isUploading, setIsUploading] = useState(false);
  const uppyRef = useRef<Uppy | null>(null);
  const stagedFilesConfigRef = useRef<Map<string, { documentName: string; folderId: string | null }>>(new Map());
  
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId);
  const [isVisibleToClient, setIsVisibleToClient] = useState(defaultVisibility);
  
  const selectedCategoryRef = useRef(selectedCategory);
  const isVisibleToClientRef = useRef(isVisibleToClient);
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  const onCompleteRef = useRef(onComplete);
  const resetStateRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);
  
  useEffect(() => {
    isVisibleToClientRef.current = isVisibleToClient;
  }, [isVisibleToClient]);

  useEffect(() => {
    onGetUploadParametersRef.current = onGetUploadParameters;
  }, [onGetUploadParameters]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const dashboardRef = useCallback((node: HTMLDivElement | null) => {
    setDashboardElement(node);
  }, []);

  const resetState = useCallback(() => {
    setStagedFiles([]);
    setStep("select");
    setIsUploading(false);
    stagedFilesConfigRef.current.clear();
    setSelectedCategory(defaultCategory);
    setSelectedFolderId(defaultFolderId);
    setIsVisibleToClient(defaultVisibility);
    selectedCategoryRef.current = defaultCategory;
    isVisibleToClientRef.current = defaultVisibility;
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
    }
  }, [defaultCategory, defaultFolderId, defaultVisibility]);

  resetStateRef.current = resetState;

  const handleClose = useCallback(() => {
    if (isUploading) return;
    setShowModal(false);
    resetState();
  }, [isUploading, resetState]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    onCategoryChange?.(value);
  };

  const handleVisibilityChange = (checked: boolean) => {
    setIsVisibleToClient(checked);
    onVisibilityChange?.(checked);
  };

  useEffect(() => {
    if (!showModal || !dashboardElement) return;

    if (uppyRef.current) {
      uppyRef.current.destroy();
      uppyRef.current = null;
    }

    const uppy = new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        async getUploadParameters(file) {
          try {
            console.log("getUploadParameters called for:", file.name, "id:", file.id);
            const params = await onGetUploadParametersRef.current({ id: file.id, name: file.name || "", size: file.size || 0, type: file.type || undefined });
            console.log("getUploadParameters returning:", params.method, params.url.substring(0, 50) + "...");
            return { ...params, fields: {} };
          } catch (error: any) {
            console.error("getUploadParameters error:", error);
            if (error?.code === "STORAGE_LIMIT_EXCEEDED") {
              setShowModal(false);
              setShowLimitExceeded(true);
              throw new Error("Storage limit exceeded");
            }
            throw error;
          }
        },
      })
      .use(Dashboard, {
        inline: true,
        target: dashboardElement,
        proudlyDisplayPoweredByUppy: false,
        width: "100%",
        height: 280,
        hideUploadButton: showStagingStep,
      });

    uppy.on("file-added", (file) => {
      console.log("Uppy file-added:", file.name, file.type, file.size);
    });

    uppy.on("upload", (uploadID: string, files: any[]) => {
      console.log("Uppy upload starting:", uploadID, files.length, "files");
    });

    uppy.on("complete", async (result) => {
      console.log("Uppy upload complete:", result);
      const stagedFilesClone = new Map(stagedFilesConfigRef.current);
      const settingsSnapshot = {
        category: selectedCategoryRef.current,
        visibility: isVisibleToClientRef.current,
      };
      setShowModal(false);
      resetStateRef.current?.();
      await onCompleteRef.current?.(result, stagedFilesClone, settingsSnapshot);
    });

    uppy.on("error", (error) => {
      console.error("Uppy error:", error);
      setIsUploading(false);
    });

    uppy.on("upload-error", (file, error, response) => {
      console.error("Uppy upload-error:", file?.name, error, response);
      setIsUploading(false);
    });

    uppy.on("upload-success", (file, response) => {
      console.log("Uppy upload-success:", file?.name, response);
    });
    
    uppy.on("upload-progress", (file, progress) => {
      console.log("Uppy upload-progress:", file?.name, progress.bytesUploaded, "/", progress.bytesTotal);
    });

    uppyRef.current = uppy;

    return () => {
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [showModal, dashboardElement, maxNumberOfFiles, maxFileSize, showStagingStep]);

  const handleProceedToConfig = () => {
    if (!uppyRef.current) return;
    
    const files = uppyRef.current.getFiles();
    if (files.length === 0) return;

    const staged: StagedFile[] = files.map((file) => ({
      id: file.id,
      name: file.name || "Unknown",
      size: file.size || 0,
      type: file.type,
      documentName: file.name?.replace(/\.[^/.]+$/, "") || "Document",
      folderId: selectedFolderId,
      uppyFile: file,
    }));

    setStagedFiles(staged);
    staged.forEach((f) => {
      stagedFilesConfigRef.current.set(f.id, {
        documentName: f.documentName,
        folderId: f.folderId === "__none__" ? null : f.folderId,
      });
    });
    setStep("configure");
  };

  const handleUpdateFileName = (fileId: string, newName: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, documentName: newName } : f))
    );
    const existing = stagedFilesConfigRef.current.get(fileId);
    if (existing) {
      stagedFilesConfigRef.current.set(fileId, { ...existing, documentName: newName });
    }
  };

  const handleUpdateFolder = (fileId: string, folderId: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, folderId } : f))
    );
    const existing = stagedFilesConfigRef.current.get(fileId);
    if (existing) {
      stagedFilesConfigRef.current.set(fileId, {
        ...existing,
        folderId: folderId === "__none__" ? null : folderId,
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    if (!uppyRef.current) return;
    uppyRef.current.removeFile(fileId);
    setStagedFiles((prev) => prev.filter((f) => f.id !== fileId));
    stagedFilesConfigRef.current.delete(fileId);
    
    if (stagedFiles.length <= 1) {
      setStep("select");
    }
  };

  const handleBackToSelect = () => {
    setStep("select");
  };

  const handleStartUpload = async () => {
    if (!uppyRef.current) return;
    setIsUploading(true);
    try {
      await uppyRef.current.upload();
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <Button 
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        data-testid="button-bulk-upload"
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl z-[100]">
          <DialogHeader>
            <DialogTitle>
              {step === "select" ? "Bulk Upload Documents" : "Configure Documents"}
            </DialogTitle>
            {step === "select" && (
              <DialogDescription>
                Set document options, then select files to upload.
              </DialogDescription>
            )}
            {step === "configure" && (
              <DialogDescription>
                Review and customize document names and folders for each file before uploading.
              </DialogDescription>
            )}
          </DialogHeader>

          {step === "select" && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {showCategorySelector && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                        <SelectTrigger data-testid="select-bulk-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Folder</label>
                    <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                      <SelectTrigger data-testid="select-bulk-folder">
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
                </div>
                {showVisibilitySelector && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bulk-visible"
                      checked={isVisibleToClient}
                      onCheckedChange={(checked) => handleVisibilityChange(checked as boolean)}
                      data-testid="checkbox-bulk-visible"
                    />
                    <label htmlFor="bulk-visible" className="text-sm">Visible to client</label>
                  </div>
                )}
                <div ref={dashboardRef} className="uppy-dashboard-container min-h-[280px]" />
              </div>
              {showStagingStep && (
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleProceedToConfig}
                    disabled={!uppyRef.current || uppyRef.current.getFiles().length === 0}
                    data-testid="button-proceed-to-config"
                  >
                    Continue to Configure
                  </Button>
                </DialogFooter>
              )}
            </>
          )}

          {step === "configure" && (
            <>
              <ScrollArea className="max-h-[400px] pr-4">
                <div className="space-y-4">
                  {stagedFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="border rounded-lg p-4 space-y-3"
                      data-testid={`staged-file-${index}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <File className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveFile(file.id)}
                          disabled={isUploading}
                          data-testid={`button-remove-staged-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Document Name</label>
                          <Input
                            value={file.documentName}
                            onChange={(e) => handleUpdateFileName(file.id, e.target.value)}
                            placeholder="Enter document name"
                            disabled={isUploading}
                            data-testid={`input-doc-name-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Folder</label>
                          <Select
                            value={file.folderId}
                            onValueChange={(val) => handleUpdateFolder(file.id, val)}
                            disabled={isUploading}
                          >
                            <SelectTrigger data-testid={`select-folder-${index}`}>
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
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToSelect}
                  disabled={isUploading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={isUploading || stagedFiles.length === 0}
                  data-testid="button-start-upload"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {stagedFiles.length} {stagedFiles.length === 1 ? "File" : "Files"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showLimitExceeded} onOpenChange={setShowLimitExceeded}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Storage Limit Reached
            </DialogTitle>
            <DialogDescription className="pt-2">
              You have reached your 1GB storage limit. To upload more files, please contact the administrator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a 
                href="mailto:admin@synkdex.com" 
                className="text-foreground hover:underline"
                data-testid="link-storage-email"
              >
                admin@synkdex.com
              </a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a 
                href="tel:8452852092" 
                className="text-foreground hover:underline"
                data-testid="link-storage-phone"
              >
                845-285-2092
              </a>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowLimitExceeded(false)}
              data-testid="button-close-storage-limit"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
