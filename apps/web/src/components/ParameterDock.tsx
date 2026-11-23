import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { ImageAnalysis } from "../workers/ip.worker";
import { CompressionPanel } from "./CompressionPanel";
import { FrequencyPanel } from "./FrequencyPanel";
import { HistogramView } from "./HistogramView";
import { Inspector } from "./Inspector";
import { MetricsPanel } from "./MetricsPanel";
import { PointOpsPanel } from "./PointOpsPanel";
import { SamplingPanel } from "./SamplingPanel";
import { SpatialPanel } from "./SpatialPanel";
import { TheoryPanel } from "./TheoryPanel";

const CHANNELS = ["luma", "r", "g", "b"] as const;
type Channel = (typeof CHANNELS)[number];
const TABS = [
  "inspect",
  "point",
  "sampling",
  "spatial",
  "frequency",
  "compression",
  "metrics",
] as const;
type Tab = (typeof TABS)[number];

function channelIndex(channel: Channel): 0 | 1 | 2 {
  return channel === "r" ? 0 : channel === "g" ? 1 : 2;
}

export function ParameterDock() {
  const { t } = useTranslation();
  const source = useImageStore((state) => state.image);
  const preview = useImageStore((state) => state.preview);
  const selected = useImageStore((state) => state.selected);
  const [tab, setTab] = useState<Tab>("inspect");
  const image = preview ?? source;
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [channel, setChannel] = useState<Channel>("luma");
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    setAnalysis(null);
    setFailed(false);
    if (!image) return;
    let cancelled = false;
    workerRef.current ??= createIpWorker();
    workerRef.current.api
      .analyze(image)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const counts = analysis
    ? channel === "luma"
      ? analysis.lumaHistogram
      : analysis.channels[channelIndex(channel)]
    : null;

  return (
    <aside
      className="flex flex-col gap-4 border-edge bg-panel p-4 lg:border-s"
      aria-label={t("dock.title")}
      data-testid="parameter-dock"
    >
      <h2 className="text-[10px] uppercase tracking-[0.18em] text-slate">{t("dock.title")}</h2>

      <nav className="flex flex-wrap gap-1" aria-label={t("dock.title")}>
        {TABS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`tab-${option}`}
            aria-pressed={tab === option}
            onClick={() => setTab(option)}
            className={`rounded-sm border px-2 py-1 text-[10px] transition-colors ${
              tab === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.tabs.${option}`)}
          </button>
        ))}
      </nav>

      {!image && (
        <div className="border border-dashed border-edge p-4">
          <p className="text-sm text-chalk">{t("dock.empty.title")}</p>
          <p className="mt-1 text-xs leading-5 text-slate">{t("dock.empty.body")}</p>
        </div>
      )}

      {image && failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      {image && !failed && !analysis && (
        <p role="status" className="text-xs text-slate">
          {t("dock.analyzing")}
        </p>
      )}

      {image && analysis && counts && (
        <>
          <section>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <dt className="text-slate">{t("transport.stats.mean")}</dt>
              <dd className="numeric">{analysis.stats.mean.toFixed(4)}</dd>
              <dt className="text-slate">{t("transport.stats.variance")}</dt>
              <dd className="numeric">{analysis.stats.variance.toFixed(4)}</dd>
              <dt className="text-slate">{t("transport.stats.entropy")}</dt>
              <dd className="numeric">{analysis.stats.entropyBits.toFixed(4)}</dd>
            </dl>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-slate">
                {t("dock.histogram.title")}
              </h3>
              <div className="flex gap-1">
                {CHANNELS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={channel === option}
                    onClick={() => setChannel(option)}
                    className={`rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                      channel === option
                        ? "border-safelight text-chalk"
                        : "border-edge text-slate hover:text-chalk"
                    }`}
                  >
                    {t(`dock.channels.${option}`)}
                  </button>
                ))}
              </div>
            </div>
            <HistogramView counts={counts} />
          </section>

          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate">
              {t("dock.inspector.title")}
            </h3>
            <Inspector image={image} selected={selected} />
          </section>
          <TheoryPanel topic="inspect" />
        </>
      )}

      {tab === "point" && <PointOpsPanel />}
      {tab === "sampling" && <SamplingPanel />}
      {tab === "spatial" && <SpatialPanel />}
      {tab === "frequency" && <FrequencyPanel />}
      {tab === "compression" && <CompressionPanel />}
      {tab === "metrics" && <MetricsPanel />}
    </aside>
  );
}
