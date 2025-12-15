import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Mail, Phone } from "lucide-react";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (file?: { size: number }) => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 52428800,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLimitExceeded, setShowLimitExceeded] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const uppyRef = useRef<Uppy | null>(null);

  useEffect(() => {
    if (!showModal || !dashboardRef.current) return;

    const uppy = new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          try {
            return await onGetUploadParameters({ size: file.size || 0 });
          } catch (error: any) {
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
        target: dashboardRef.current,
        proudlyDisplayPoweredByUppy: false,
        width: "100%",
        height: 300,
      });

    uppy.on("complete", (result) => {
      onComplete?.(result);
      setShowModal(false);
    });

    uppyRef.current = uppy;

    return () => {
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [showModal, maxNumberOfFiles, maxFileSize, onGetUploadParameters, onComplete]);

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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg z-[100]">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <div ref={dashboardRef} className="uppy-dashboard-container min-h-[300px]" />
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
              You have reached your 10MB storage limit. To upload more files, please contact the administrator.
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
