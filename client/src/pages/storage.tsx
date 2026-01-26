import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive } from "lucide-react";
import { motion } from "framer-motion";
import { StorageAPI } from "@/lib/storage-api";
import { EmptyState, PageContainer, SectionHeading } from "@/ui-kit";

interface StorageStats {
  totalSize: number;
  fileCount: number;
  folderCount: number;
  usedPercentage: number;
}

export default function Storage() {
  const { data: storageStats, isLoading } = useQuery<StorageStats>({
    queryKey: ["storage:stats"],
    queryFn: () => StorageAPI.getStats(),
  });

  const totalGB = 10; // 10GB max
  const usedGB = storageStats ? (storageStats.totalSize / (1024 ** 3)).toFixed(2) : "0.00";
  const percentage = storageStats ? Math.min(storageStats.usedPercentage, 100) : 0;
  const availableGB = (totalGB - parseFloat(usedGB)).toFixed(2);

  return (
    <PageContainer className="space-y-8">
      <SectionHeading
        title="Storage"
        description="Monitor your storage usage and capacity"
      />

      {!isLoading && !storageStats && (
        <EmptyState
          title="Storage details unavailable"
          description="Try again in a moment to load usage details."
        />
      )}

      <SectionHeading
        title="Capacity"
        description="Space usage for this device"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <HardDrive className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Storage Capacity</CardTitle>
                <CardDescription>Total storage allocation and usage</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm text-muted-foreground">Used Storage</span>
                <span className="text-3xl font-bold" data-testid="text-used-storage">
                  {usedGB} <span className="text-lg text-muted-foreground">GB</span>
                </span>
              </div>
              <Progress value={percentage} className="h-4" data-testid="progress-storage-main" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{percentage}% used</span>
                <span className="font-medium">{usedGB} GB of {totalGB.toFixed(2)} GB</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Capacity</p>
                <p className="text-2xl font-semibold" data-testid="text-total-capacity">{totalGB.toFixed(2)} GB</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Used Space</p>
                <p className="text-2xl font-semibold text-primary" data-testid="text-used-space">{usedGB} GB</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-semibold text-chart-5" data-testid="text-available-space">{availableGB} GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <SectionHeading
        title="Content"
        description="Files and folders stored locally"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>File Statistics</CardTitle>
            <CardDescription>Overview of your stored content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Total Files</span>
                <span className="text-2xl font-bold" data-testid="text-file-count">
                  {isLoading ? "..." : storageStats?.fileCount ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Total Folders</span>
                <span className="text-2xl font-bold" data-testid="text-folder-count">
                  {isLoading ? "..." : storageStats?.folderCount ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
