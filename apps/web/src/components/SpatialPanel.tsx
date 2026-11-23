import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { SpatialRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type SpatialKind =
  | "none"
  | "mean"
  | "gaussian"
  | "median"
  | "bilateral"
  | "sharpen"
  | "unsharp"
  | "sobel"
  | "prewitt"
  | "laplacian"
  | "log"
  | "canny";

const OPS: SpatialKind[] = [
  "mean",
  "gaussian",
  "median",
  "bilateral",
  "sharpen",
  "unsharp",
  "sobel",
  "prewitt",
  "laplacian",
  "log",
  "canny",
];

export function SpatialPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [op, setOp] = useState<SpatialKind>("none");
  const [size, setSize] = useState(5);
  const [sigma, setSigma] = useState(1);
  const [radius, setRadius] = useState(2);
  const [sigmaSpace, setSigmaSpace] = useState(2);
  const [sigmaRange, setSigmaRange] = useState(0.1);
  const [amount, setAmount] = useState(1);
  const [low, setLow] = useState(0.08);
  const [high, setHigh] = useState(0.2);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    if (!image || op === "none") {
      setPreview(null);
      return;
    }
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request: SpatialRequest =
        op === "mean"
          ? { kind: "mean", size }
          : op === "gaussian"
            ? { kind: "gaussian", size, sigma }
            : op === "median"
              ? { kind: "median", radius }
              : op === "bilateral"
                ? { kind: "bilateral", radius, sigmaSpace, sigmaRange }
                : op === "unsharp"
                  ? { kind: "unsharp", sigma, amount }
                  : op === "log"
                    ? { kind: "log", sigma }
                    : op === "canny"
                      ? { kind: "canny", low, high, sigma }
                      : { kind: op };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applySpatial(image, request)
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, op, size, sigma, radius, sigmaSpace, sigmaRange, amount, low, high, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const needsSize = op === "mean" || op === "gaussian";

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1">
        {OPS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`spatial-${option}`}
            aria-pressed={op === option}
            onClick={() => setOp(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
              op === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.spatial.ops.${option}`)}
          </button>
        ))}
      </div>

      {needsSize && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.spatial.size")}</span>
          <select
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
            className="border border-edge bg-ink px-1 py-0.5 text-chalk"
          >
            {[3, 5, 7, 9].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}

      {(op === "gaussian" || op === "unsharp" || op === "log" || op === "canny") && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>σ</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={sigma}
            onChange={(event) => setSigma(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{sigma.toFixed(1)}</span>
        </label>
      )}

      {(op === "median" || op === "bilateral") && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.spatial.radius")}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{radius}</span>
        </label>
      )}

      {op === "bilateral" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>σs</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={sigmaSpace}
              onChange={(event) => setSigmaSpace(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{sigmaSpace.toFixed(1)}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>σr</span>
            <input
              type="range"
              min={0.02}
              max={0.4}
              step={0.01}
              value={sigmaRange}
              onChange={(event) => setSigmaRange(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{sigmaRange.toFixed(2)}</span>
          </label>
        </>
      )}

      {op === "unsharp" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.spatial.amount")}</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{amount.toFixed(1)}</span>
        </label>
      )}

      {op === "canny" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>low</span>
            <input
              type="range"
              min={0.05}
              max={0.3}
              step={0.01}
              value={low}
              onChange={(event) => setLow(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{low.toFixed(2)}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>high</span>
            <input
              type="range"
              min={0.32}
              max={0.6}
              step={0.01}
              value={high}
              onChange={(event) => setHigh(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{high.toFixed(2)}</span>
          </label>
        </>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="spatial-reset"
        onClick={() => {
          setOp("none");
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="spatial" />
    </section>
  );
}
