"use client";

import { useEffect, useRef } from "react";
import { X, Pause, Play, ArrowDownToLine, ArrowUpFromLine, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransferOptional } from "@/contexts/transfer-context";
import { Button } from "@/components/ui/button";
function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

function CircularRing({ percent, className }: { percent: number; className?: string }) {
  const p = Math.min(100, Math.max(0, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <svg className={cn("shrink-0", className)} width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-300"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
    </svg>
  );
}

declare global {
  interface Window {
    joincloud?: {
      onShareProgress?: (cb: (data: { pct: number; bytesSent: number; total: number }) => void) => () => void;
    };
  }
}

export function TransferOverlay() {
  const ctx = useTransferOptional();
  const shareIdRef = useRef("share-outbound");

  useEffect(() => {
    const unsub = window.joincloud?.onShareProgress?.((data) => {
      if (!ctx) return;
      const total = data.total || 1;
      const pct = data.pct ?? Math.round((data.bytesSent / total) * 100);
      ctx.upsertItem({
        id: shareIdRef.current,
        direction: "sending",
        fileName: "Shared download",
        fileSize: total,
        percent: Math.min(100, pct),
        bytesSent: data.bytesSent,
        totalBytes: total,
        status: pct >= 100 ? "complete" : "active",
      });
      if (pct >= 100) {
        setTimeout(() => ctx.removeItem(shareIdRef.current), 2500);
      }
    });
    return () => {
      unsub?.();
    };
  }, [ctx]);

  if (!ctx) return null;

  const show = ctx.items
    .filter((x) => x.percent < 100 || x.status === "paused" || x.status === "active")
    .slice(-3);
  if (show.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm pointer-events-auto">
      {show.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-lg p-4 flex gap-3 items-center animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="relative">
            <CircularRing percent={item.percent} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-semibold tabular-nums">{Math.round(item.percent)}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {item.direction === "uploading" && (
                <>
                  <ArrowUpFromLine className="h-3 w-3" /> Uploading
                </>
              )}
              {item.direction === "receiving" && (
                <>
                  <ArrowDownToLine className="h-3 w-3" /> Receiving
                </>
              )}
              {item.direction === "sending" && (
                <>
                  <Share2 className="h-3 w-3" /> Sending
                </>
              )}
            </div>
            <p className="font-medium truncate text-sm mt-0.5" title={item.fileName}>
              {item.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(item.fileSize)}
              {item.chunkLabel ? ` · ${item.chunkLabel}` : ""}
            </p>
            {(item.speedLabel || item.etaLabel) && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.speedLabel}
                {item.etaLabel ? ` · ETA ${item.etaLabel}` : ""}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => ctx.removeItem(item.id)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
