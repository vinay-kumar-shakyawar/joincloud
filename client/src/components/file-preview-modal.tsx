import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { StorageAPI } from "@/lib/storage-api";
import type { FileItem } from "@shared/schema";

interface FilePreviewModalProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewModal({ file, open, onOpenChange }: FilePreviewModalProps) {
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  if (!file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";
  const fileUrl = `/api/files/${file.id}/content`;

  const handleOpenFile = async () => {
    setIsOpening(true);
    try {
      await StorageAPI.openFile(file.id);
      toast({
        title: "File opened",
        description: `Opening "${file.name}" with default application`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to open file",
        description: error.message || "Could not open file",
        variant: "destructive",
      });
    } finally {
      setIsOpening(false);
    }
  };

  const handleShowInFinder = async () => {
    setIsShowing(true);
    try {
      await StorageAPI.showInFinder(file.id);
      toast({
        title: "Showing in Finder",
        description: `Revealed "${file.name}" in Finder`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to show file",
        description: error.message || "Could not show file",
        variant: "destructive",
      });
    } finally {
      setIsShowing(false);
    }
  };

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.storage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden"
        data-testid="dialog-preview"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          <div className="flex items-center justify-between p-4 border-b gap-3">
            <h3 className="font-semibold truncate flex-1" title={file.name}>
              {file.name}
            </h3>
            {isElectron && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowInFinder}
                  disabled={isShowing}
                  data-testid="button-show-in-finder"
                >
                  {isShowing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Show in Finder
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenFile}
                  disabled={isOpening}
                  data-testid="button-open-file"
                >
                  {isOpening ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="p-6 max-h-[calc(90vh-140px)] overflow-auto bg-background/50 backdrop-blur-sm">
            {!isElectron && isImage && (
              <div className="relative group rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
                <img
                  src={fileUrl}
                  alt={file.name}
                  className="max-w-full h-auto mx-auto"
                  data-testid="img-preview"
                />
              </div>
            )}
            {!isElectron && isPDF && (
              <iframe
                src={fileUrl}
                className="w-full h-[70vh] rounded-lg border"
                title={file.name}
                data-testid="iframe-pdf-preview"
              />
            )}
            {isElectron && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Click "Open" to view this file with your default application
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Size: {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
