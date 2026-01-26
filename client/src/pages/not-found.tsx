import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { EmptyState, PageContainer } from "@/ui-kit";

export default function NotFound() {
  return (
    <PageContainer className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardContent>
          <EmptyState
            icon={<AlertCircle className="h-8 w-8" />}
            title="404 Page Not Found"
            description="Did you forget to add the page to the router?"
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
