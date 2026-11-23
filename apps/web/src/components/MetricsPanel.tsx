import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { MetricsComparison, RateDistortionPoint } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

const RD_QUALITIES = [10, 25, 40, 55, 70, 85];

function Heatmap({ comparison }: { comparison: MetricsComparison }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = comparison.width;
    canvas.height = comparison.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = new Uint8ClampedArray(comparison.heatmap.data.length);
    pixels.set(comparison.heatmap.data);
    context.putImageData(new ImageData(pixels, comparison.width, comparison.height), 0, 0);
  }, [comparison]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="metrics-heatmap"
      aria-label="error heatmap"
      className="mx-auto block max-h-48 w-auto max-w-full border border-edge"
    />
  );
}

function SsimMap({ comparison }: { comparison: MetricsComparison }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = comparison.width;
    canvas.height = comparison.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const data = new Uint8ClampedArray(comparison.width * comparison.height * 4);
    for (let i = 0; i < comparison.ssimMap.length; i += 1) {
      const value = Math.round(((comparison.ssimMap[i] ?? 0) + 1) * 127.5);
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    context.putImageData(new ImageData(data, comparison.width, comparison.height), 0, 0);
  }, [comparison]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="ssim-map"
      aria-label="SSIM map"
      className="mx-auto block max-h-48 w-auto max-w-full border border-edge"
    />
  );
}

function RdChart({ points }: { points: RateDistortionPoint[] }) {
  if (points.length === 0) return null;
  const width = 240;
  const height = 120;
  const padding = 18;
  const bpss = points.map((point) => point.bpp);
  const psnrs = points.map((point) => Math.min(60, point.psnr));
  const minBpp = Math.min(...bpss);
  const maxBpp = Math.max(...bpss);
  const minPsnr = Math.min(...psnrs);
  const maxPsnr = Math.max(...psnrs);
  const x = (bpp: number) =>
    padding + ((bpp - minBpp) / Math.max(1e-9, maxBpp - minBpp)) * (width - padding * 2);
  const y = (psnr: number) =>
    height -
    padding -
    ((psnr - minPsnr) / Math.max(1e-9, maxPsnr - minPsnr)) * (height - padding * 2);
  const path = points
    .slice()
    .sort((a, b) => a.bpp - b.bpp)
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.bpp).toFixed(1)},${y(Math.min(60, point.psnr)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      data-testid="rd-chart"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full border border-edge bg-ink"
      role="img"
      aria-label="rate-distortion curve"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        className="text-safelight"
        strokeWidth={1.5}
      />
      {points.map((point) => (
        <circle
          key={point.quality}
          cx={x(point.bpp)}
          cy={y(Math.min(60, point.psnr))}
          r={2}
          className="fill-chalk"
        >
          <title>
            q{point.quality}: {point.bpp.toFixed(2)} bpp, {point.psnr.toFixed(2)} dB
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function MetricsPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const [quality, setQuality] = useState(50);
  const [comparison, setComparison] = useState<MetricsComparison | null>(null);
  const [points, setPoints] = useState<RateDistortionPoint[]>([]);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    setComparison(null);
    setPoints([]);
    if (!image) return;
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .compressJpeg(image, quality)
        .then((compressed) => workerRef.current?.api.metricsCompare(image, compressed.image))
        .then((result) => {
          if (!cancelled && result) setComparison(result);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, quality]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const computeRateDistortion = () => {
    if (!image) return;
    setFailed(false);
    workerRef.current ??= createIpWorker();
    workerRef.current.api
      .rateDistortion(image, RD_QUALITIES)
      .then(setPoints)
      .catch(() => setFailed(true));
  };

  return (
    <section className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.metrics.quality")}</span>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={quality}
          data-testid="metrics-quality"
          onChange={(event) => setQuality(Number(event.target.value))}
          className="w-32 accent-safelight"
        />
        <span className="numeric text-chalk">{quality}</span>
      </label>

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      {comparison && (
        <>
          <dl data-testid="metrics-values" className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-slate">{t("dock.metrics.mse")}</dt>
            <dd className="numeric">{comparison.metrics.mse.toFixed(2)}</dd>
            <dt className="text-slate">{t("dock.metrics.psnr")}</dt>
            <dd className="numeric">{comparison.metrics.psnr.toFixed(2)} dB</dd>
            <dt className="text-slate">{t("dock.metrics.ssim")}</dt>
            <dd className="numeric">{comparison.metrics.ssim.toFixed(4)}</dd>
            <dt className="text-slate">{t("dock.metrics.msSsim")}</dt>
            <dd className="numeric">{comparison.metrics.msSsim.toFixed(4)}</dd>
          </dl>
          <div>
            <h3 className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate">
              {t("dock.metrics.ssimMap")}
            </h3>
            <SsimMap comparison={comparison} />
          </div>
          <div>
            <h3 className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate">
              {t("dock.metrics.heatmap")}
            </h3>
            <Heatmap comparison={comparison} />
          </div>
        </>
      )}

      <button
        type="button"
        data-testid="metrics-reset"
        onClick={() => setQuality(50)}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <button
        type="button"
        data-testid="metrics-rd"
        disabled={!image}
        onClick={computeRateDistortion}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk disabled:opacity-40"
      >
        {t("dock.metrics.computeRd")}
      </button>

      {points.length > 0 && (
        <div>
          <h3 className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate">
            {t("dock.metrics.rd")}
          </h3>
          <RdChart points={points} />
        </div>
      )}

      <TheoryPanel topic="metrics" />
    </section>
  );
}
