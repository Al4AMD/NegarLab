import { useEffect, useState } from "react";

export type HealthStatus = "checking" | "online" | "offline";

const POLL_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 3_000;

async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/v1/health", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("application/json")) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "status" in body && body.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function useHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const online = await probe();
      if (!cancelled) setStatus(online ? "online" : "offline");
    };
    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return status;
}
