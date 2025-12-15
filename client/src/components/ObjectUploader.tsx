import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
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
        getUploadParameters: onGetUploadParameters,
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <div ref={dashboardRef} className="uppy-dashboard-container" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
