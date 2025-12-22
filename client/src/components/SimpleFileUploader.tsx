import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Mail, Phone, Upload, Loader2, CheckCircle, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SimpleFileUploaderProps {
  maxFileSize?: number;
  onGetUploadParameters: (file: { size: number; type?: string }) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onUploadComplete?: (file: File) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function SimpleFileUploader({
  maxFileSize = 52428800,
  onGetUploadParameters,
  onUploadComplete,
  buttonClassName,
  children,
}: SimpleFileUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLimitExceeded, setShowLimitExceeded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      setError(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadComplete(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const params = await onGetUploadParameters({
        size: selectedFile.size,
        type: selectedFile.type,
      });

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open(params.method, params.url);
        
        if (params.headers) {
          Object.entries(params.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        xhr.send(selectedFile);
      });

      setUploadComplete(true);
      onUploadComplete?.(selectedFile);
      
      setTimeout(() => {
        setShowModal(false);
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadComplete(false);
      }, 500);

    } catch (err: any) {
      console.error("Upload error:", err);
      if (err?.code === "STORAGE_LIMIT_EXCEEDED") {
        setShowModal(false);
        setShowLimitExceeded(true);
      } else {
        setError(err.message || "Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
    setUploadComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setShowModal(false);
      setSelectedFile(null);
      setError(null);
      setUploadProgress(0);
      setUploadComplete(false);
    }
  };

  return (
    <div>
      <Button 
        type="button"
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        data-testid="button-upload-file"
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent className="max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!selectedFile ? (
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Click to select a file
                </p>
                <p className="text-xs text-muted-foreground">
                  Max file size: {Math.round(maxFileSize / 1024 / 1024)}MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-select"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium break-words" title={selectedFile.name}>{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {!uploading && !uploadComplete && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleRemoveFile}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {uploadComplete && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleUpload} 
              disabled={!selectedFile || uploading || uploadComplete}
              data-testid="button-start-upload"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : uploadComplete ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
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
                href="mailto:admin@synccos.com" 
                className="text-foreground hover:underline"
                data-testid="link-storage-email"
              >
                admin@synccos.com
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
