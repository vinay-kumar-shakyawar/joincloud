import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChunkUploadController } from "@/lib/chunk-upload";
import { useTransferOptional } from "@/contexts/transfer-context";
import { formatEta, formatSpeed as formatSpeedBps } from "@/lib/format-transfer";

interface UploadZoneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "paused" | "complete" | "error";
  error?: string;
  speedLabel?: string;
  etaLabel?: string;
  chunkLabel?: string;
}

export function UploadZone({ open, onOpenChange, parentPath = "/" }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const controllerRef = useRef<ChunkUploadController | null>(null);
  const transferIdRef = useRef<string>("");
  const { toast } = useToast();
  const transfer = useTransferOptional();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const targetPathForUpload = parentPath === "/" ? "/" : `/${parentPath.replace(/^\/+/, "")}`;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const newUploadingFiles: UploadingFile[] = fileArray.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadingFiles(newUploadingFiles);

      let successCount = 0;
      let hasError = false;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const transferId = `upload-${Date.now()}-${i}-${file.name}`;
        transferIdRef.current = transferId;
        setActiveIndex(i);

        const controller = new ChunkUploadController();
        controllerRef.current = controller;

        transfer?.upsertItem({
          id: transferId,
          direction: "uploading",
          fileName: file.name,
          fileSize: file.size,
          percent: 0,
          totalBytes: file.size,
          status: "active",
        });

        try {
          await controller.upload(file, targetPathForUpload, {
            credentials: "include",
            onProgress: (p) => {
              setUploadingFiles((prev) => {
                const next = [...prev];
                if (next[i]) {
                  next[i] = {
                    ...next[i],
                    progress: Math.round(p.percent),
                    chunkLabel: `${p.chunkIndex + 1} / ${p.totalChunks} chunks`,
                    speedLabel: formatSpeedBps(p.speedBps),
                    etaLabel: formatEta(p.etaSeconds),
                  };
                }
                return next;
              });
              transfer?.updateItem(transferId, {
                percent: Math.round(p.percent),
                bytesSent: p.bytesSent,
                totalBytes: p.totalBytes,
                chunkLabel: `${p.chunkIndex + 1} / ${p.totalChunks} chunks`,
                speedLabel: formatSpeedBps(p.speedBps),
                etaLabel: formatEta(p.etaSeconds),
                status: p.percent >= 100 ? "complete" : "active",
              });
            },
          });

          setUploadingFiles((prev) => {
            const next = [...prev];
            if (next[i]) {
              next[i] = { ...next[i], progress: 100, status: "complete" };
            }
            return next;
          });
          transfer?.updateItem(transferId, {
            percent: 100,
            status: "complete",
          });
          setTimeout(() => transfer?.removeItem(transferId), 2000);
          successCount += 1;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Upload failed";
          if (msg === "Upload cancelled" || msg.includes("cancelled")) {
            setUploadingFiles((prev) => {
              const next = [...prev];
              if (next[i]) next[i] = { ...next[i], status: "error", error: "Cancelled" };
              return next;
            });
            transfer?.removeItem(transferId);
            hasError = true;
            break;
          }
          hasError = true;
          setUploadingFiles((prev) => {
            const next = [...prev];
            if (next[i]) {
              next[i] = {
                ...next[i],
                progress: 0,
                status: "error" as const,
                error: msg,
              };
            }
            return next;
          });
          transfer?.updateItem(transferId, { status: "error", error: msg });
        }

        controllerRef.current = null;
      }

      setActiveIndex(null);

      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage"] });

      if (hasError) {
        toast({
          title: successCount > 0 ? "Partial upload complete" : "Upload failed",
          description:
            successCount > 0
              ? `${successCount} of ${fileArray.length} files uploaded`
              : "Some or all files failed to upload",
          variant: hasError ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Upload complete",
          description: "Your files have been uploaded successfully",
        });
      }

      setTimeout(() => {
        onOpenChange(false);
        setUploadingFiles([]);
      }, 1500);
    },
    [parentPath, queryClient, targetPathForUpload, toast, onOpenChange, transfer]
  );

  const handlePause = () => {
    controllerRef.current?.pause();
    if (activeIndex !== null) {
      setUploadingFiles((prev) => {
        const next = [...prev];
        if (next[activeIndex]) next[activeIndex] = { ...next[activeIndex], status: "paused" };
        return next;
      });
      const id = transferIdRef.current;
      if (id) transfer?.updateItem(id, { status: "paused" });
    }
  };

  const handleResume = () => {
    controllerRef.current?.resume();
    if (activeIndex !== null) {
      setUploadingFiles((prev) => {
        const next = [...prev];
        if (next[activeIndex]) next[activeIndex] = { ...next[activeIndex], status: "uploading" };
        return next;
      });
      const id = transferIdRef.current;
      if (id) transfer?.updateItem(id, { status: "active" });
    }
  };

  const handleCancel = () => {
    controllerRef.current?.cancel();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const displayPath = parentPath === "/" ? "Home" : parentPath.split("/").pop() || "Home";

  const showControls =
    uploadingFiles.length > 0 &&
    activeIndex !== null &&
    uploadingFiles[activeIndex]?.status === "uploading";
  const showPaused =
    uploadingFiles.length > 0 &&
    activeIndex !== null &&
    uploadingFiles[activeIndex]?.status === "paused";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Uploading to: <span className="font-medium text-foreground">{displayPath}</span>
          </p>
        </DialogHeader>

        {uploadingFiles.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${isDragging ? "border-primary bg-primary/2" : "border-border"}
            `}
          >
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: isDragging ? 1.05 : 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold mb-1">
                  {isDragging ? "Drop files here" : "Drag and drop files here"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-browse-files"
                >
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {uploadingFiles.map((uploadFile, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="border rounded-lg p-4"
                  data-testid={`upload-item-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" title={uploadFile.file.name}>
                        {uploadFile.file.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadFile.file.size / 1024).toFixed(1)} KB
                        {uploadFile.chunkLabel ? ` · ${uploadFile.chunkLabel}` : ""}
                      </p>
                      {(uploadFile.speedLabel || uploadFile.etaLabel) && uploadFile.status === "uploading" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {uploadFile.speedLabel}
                          {uploadFile.etaLabel ? ` · ETA ${uploadFile.etaLabel}` : ""}
                        </p>
                      )}
                      <div className="mt-2 space-y-1">
                        <Progress
                          value={uploadFile.status === "complete" ? 100 : uploadFile.progress}
                          className="h-2"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {uploadFile.status === "complete"
                              ? "100%"
                              : `${uploadFile.progress}%`}
                          </span>
                          {uploadFile.status === "complete" ? (
                            <span className="text-chart-5 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Complete
                            </span>
                          ) : uploadFile.status === "error" ? (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {uploadFile.error || "Failed"}
                            </span>
                          ) : uploadFile.status === "paused" ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Pause className="h-3 w-3" />
                              Paused
                            </span>
                          ) : (
                            <span className="text-primary flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Uploading
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {uploadingFiles.length > 0 && uploadingFiles.some((u) => u.status === "uploading" || u.status === "paused") && (
          <div className="flex justify-end gap-2 pt-4 border-t flex-wrap">
            {showControls && (
              <Button variant="secondary" onClick={handlePause} data-testid="button-pause-upload">
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {showPaused && (
              <Button variant="secondary" onClick={handleResume} data-testid="button-resume-upload">
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-upload">
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
