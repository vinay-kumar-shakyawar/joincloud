"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShieldCheck } from "lucide-react"

export function NgrokTunnel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          Public Sharing Gateway
        </CardTitle>
        <CardDescription>Public sharing is handled by the VPS gateway.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            No tunnel needs to be started locally. Public URLs are generated per share.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
