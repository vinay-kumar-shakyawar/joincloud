"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, CheckCircle } from "lucide-react"

interface ShareResponse {
  shareId: string
  url?: string | null
  expiresAt?: string
}

export function ShareFiles({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [maxDownloads, setMaxDownloads] = useState(1)
  const [hasScheduledWindow, setHasScheduledWindow] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [loading, setLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateShare = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fileId,
          permission: "read-only",
          ttlMs: durationMinutes * 60 * 1000,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create share")
      }

      const data: ShareResponse = await response.json()
      if (data.url) {
        setShareLink(data.url)
        return
      }
      setShareLink(`https://${data.shareId}.share.joincloud.in`)
    } catch (error) {
      console.error("Error creating share:", error)
      alert("Failed to create share link")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share File</DialogTitle>
          <DialogDescription>Create a temporary shareable link for {fileName} with auto-expiration</DialogDescription>
        </DialogHeader>

        {shareLink ? (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">Share link created successfully!</AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <p className="text-sm font-medium">Share created</p>
              <Input value={shareLink} readOnly className="text-sm font-mono" />
              <Button size="sm" variant="outline" onClick={copyToClipboard} className="w-fit gap-2 bg-transparent">
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>

            <Button
              onClick={() => {
                setShareLink(null)
                setPassword("")
                setDurationMinutes(60)
                setMaxDownloads(1)
              }}
              className="w-full"
              variant="outline"
            >
              Create Another Share
            </Button>

            <Button onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Expiration Time (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="10080"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value) || 60)}
                placeholder="60"
              />
              <p className="text-xs text-muted-foreground">
                Link will expire in {durationMinutes} minute{durationMinutes !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDownloads">Max Downloads (optional)</Label>
              <Input
                id="maxDownloads"
                type="number"
                min="1"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(Number.parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password Protection (optional)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasScheduledWindow}
                    onChange={(e) => setHasScheduledWindow(e.target.checked)}
                    className="rounded"
                  />
                  Scheduled Availability Window
                </CardTitle>
                <CardDescription className="text-xs">Link only accessible during specified time range</CardDescription>
              </CardHeader>
              {hasScheduledWindow && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-sm">
                      Available From
                    </Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-sm">
                      Available Until
                    </Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateShare} disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Share Link"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
