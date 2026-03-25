"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type TransferDirection = "uploading" | "receiving" | "sending";

export interface TransferItem {
  id: string;
  direction: TransferDirection;
  fileName: string;
  fileSize: number;
  percent: number;
  bytesSent?: number;
  totalBytes?: number;
  chunkLabel?: string;
  speedLabel?: string;
  etaLabel?: string;
  status: "active" | "paused" | "complete" | "error";
  error?: string;
}

interface TransferContextValue {
  items: TransferItem[];
  upsertItem: (item: TransferItem) => void;
  updateItem: (id: string, patch: Partial<TransferItem>) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
}

const TransferContext = createContext<TransferContextValue | null>(null);

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TransferItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const upsertItem = useCallback((item: TransferItem) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      if (i === -1) return [...prev, item];
      const next = [...prev];
      next[i] = { ...next[i], ...item };
      return next;
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<TransferItem>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((x) => x.status !== "complete"));
  }, []);

  /** Poll server for incoming chunked uploads (other devices uploading to host). */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/v1/transfer/active", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const transfers = Array.isArray(data.transfers) ? data.transfers : [];
        setItems((prev) => {
          const incomingIds = new Set(
            transfers.map((t: { transferId: string }) => `incoming-${t.transferId}`)
          );
          const kept = prev.filter(
            (x) => x.direction !== "receiving" || incomingIds.has(x.id)
          );
          const next = [...kept];
          for (const t of transfers) {
            const id = `incoming-${t.transferId}`;
            const pct = (t.percentComplete ?? 0) as number;
            const idx = next.findIndex((x) => x.id === id);
            const item: TransferItem = {
              id,
              direction: "receiving",
              fileName: String(t.fileName || "Upload"),
              fileSize: Number(t.totalBytes) || 0,
              percent: Math.min(100, pct),
              bytesSent: Math.round(((Number(t.totalBytes) || 0) * pct) / 100),
              totalBytes: Number(t.totalBytes) || 0,
              chunkLabel:
                t.totalChunks != null && t.chunksReceived != null
                  ? `${t.chunksReceived} / ${t.totalChunks} chunks`
                  : undefined,
              status: pct >= 100 ? "complete" : "active",
            };
            if (idx === -1) next.push(item);
            else next[idx] = { ...next[idx], ...item };
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    };

    pollRef.current = setInterval(poll, 1200);
    poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({ items, upsertItem, updateItem, removeItem, clearCompleted }),
    [items, upsertItem, updateItem, removeItem, clearCompleted]
  );

  return <TransferContext.Provider value={value}>{children}</TransferContext.Provider>;
}

export function useTransfer() {
  const ctx = useContext(TransferContext);
  if (!ctx) {
    throw new Error("useTransfer must be used within TransferProvider");
  }
  return ctx;
}

export function useTransferOptional() {
  return useContext(TransferContext);
}
