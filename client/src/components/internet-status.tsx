import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Strength = "strong" | "weak" | "offline";

interface InternetStatus {
  connected: boolean;
  latencyMs: number | null;
  strength: Strength;
}

const POLL_INTERVAL_MS = 4000;
const LATENCY_STRONG = 150;
const LATENCY_WEAK = 500;

declare global {
  interface Window {
    joincloud?: {
      checkInternet?: () => Promise<{ connected: boolean; latencyMs: number | null; strength: Strength }>;
      [key: string]: any;
    };
  }
}

async function checkConnectivity(): Promise<InternetStatus> {
  // Electron path: use IPC → Electron net module (bypasses CORS, works offline)
  if (typeof window !== "undefined" && window.joincloud?.checkInternet) {
    return window.joincloud.checkInternet();
  }

  // Browser fallback: fetch favicon with no-cors (measures round-trip time)
  const start = Date.now();
  try {
    await fetch("https://www.google.com/favicon.ico", {
      mode: "no-cors",
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    const strength: Strength = latencyMs < LATENCY_STRONG ? "strong" : latencyMs < LATENCY_WEAK ? "weak" : "weak";
    return { connected: true, latencyMs, strength };
  } catch {
    return { connected: false, latencyMs: null, strength: "offline" };
  }
}

export function InternetStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<InternetStatus>({
    connected: true,
    latencyMs: null,
    strength: "strong",
  });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await checkConnectivity();
      if (!cancelled) {
        setStatus(result);
        setChecked(true);
      }
    };

    run();
    const interval = setInterval(run, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!checked) return null;

  const { strength, latencyMs } = status;

  const dotColor =
    strength === "strong"
      ? "bg-green-500"
      : strength === "weak"
      ? "bg-yellow-500"
      : "bg-red-500";

  const label =
    strength === "strong"
      ? "Online – Strong"
      : strength === "weak"
      ? "Online – Weak"
      : "Offline";

  const latencyLabel = latencyMs !== null ? ` (${latencyMs}ms)` : "";

  return (
    <div
      className={cn("flex items-center gap-1.5 select-none", className)}
      title={`${label}${latencyLabel}`}
      aria-label={`Internet status: ${label}${latencyLabel}`}
    >
      <span className="relative flex h-2 w-2">
        {strength !== "offline" && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-50",
              dotColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            dotColor
          )}
        />
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
