import type { ImageStats } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import { generateTestImage } from "../lib/testImage";

type Status = "idle" | "running" | "done" | "error";

export function SystemCheck() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("idle");
  const [stats, setStats] = useState<ImageStats | null>(null);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = async () => {
    setStatus("running");
    setStats(null);
    try {
      workerRef.current ??= createIpWorker();
      const result = await workerRef.current.api.analyze(generateTestImage());
      setStats(result.stats);
      setStatus("done");
    } catch {
      workerRef.current?.terminate();
      workerRef.current = null;
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="system-check">
      <button
        type="button"
        onClick={() => void run()}
        disabled={status === "running"}
        className="rounded-sm border border-edge px-3 py-1.5 text-[11px] text-chalk transition-colors hover:border-safelight disabled:cursor-wait disabled:text-slate"
      >
        {status === "running" ? t("transport.systemCheckRunning") : t("transport.systemCheck")}
      </button>

      {stats && (
        <dl
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
          data-testid="stats-readout"
        >
          <div className="flex items-center gap-1.5">
            <dt className="text-slate">{t("transport.stats.mean")}</dt>
            <dd className="numeric">{stats.mean.toFixed(4)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate">{t("transport.stats.variance")}</dt>
            <dd className="numeric">{stats.variance.toFixed(4)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate">{t("transport.stats.entropy")}</dt>
            <dd className="numeric">{stats.entropyBits.toFixed(4)}</dd>
          </div>
        </dl>
      )}

      {status === "error" && (
        <span role="alert" className="text-[11px] text-safelight">
          {t("transport.systemCheckError")}
        </span>
      )}
    </div>
  );
}
