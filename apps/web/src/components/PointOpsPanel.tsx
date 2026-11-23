import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { OpRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type OpKind = "none" | "negative" | "log" | "gamma" | "equalize" | "stretch" | "otsu" | "clahe";

const OPS: OpKind[] = ["negative", "log", "gamma", "equalize", "stretch", "otsu", "clahe"];

export function PointOpsPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [op, setOp] = useState<OpKind>("none");
  const [gamma, setGamma] = useState(0.6);
  const [low, setLow] = useState(0.05);
  const [high, setHigh] = useState(0.95);
  const [tiles, setTiles] = useState(8);
  const [clipLimit, setClipLimit] = useState(2);
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
      const request: OpRequest | null =
        op === "gamma"
          ? { kind: "gamma", gamma }
          : op === "stretch"
            ? { kind: "stretch", low, high }
            : op === "clahe"
              ? { kind: "clahe", tiles, clipLimit }
              : { kind: op };
      if (!request) return;
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyOps(image, [request])
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, op, gamma, low, high, tiles, clipLimit, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1">
        {OPS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`op-${option}`}
            aria-pressed={op === option}
            onClick={() => setOp(option)}
            className={`rounded-sm border px-2 py-1 text-[10px] transition-colors ${
              op === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.point.ops.${option}`)}
          </button>
        ))}
      </div>

      {op === "gamma" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>gamma</span>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={gamma}
            data-testid="gamma-slider"
            onChange={(event) => setGamma(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{gamma.toFixed(2)}</span>
        </label>
      )}

      {op === "stretch" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>lo</span>
            <input
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={low}
              onChange={(event) => setLow(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{low.toFixed(2)}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>hi</span>
            <input
              type="range"
              min={0.55}
              max={1}
              step={0.01}
              value={high}
              onChange={(event) => setHigh(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{high.toFixed(2)}</span>
          </label>
        </>
      )}

      {op === "clahe" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.point.tiles")}</span>
            <select
              value={tiles}
              onChange={(event) => setTiles(Number(event.target.value))}
              className="border border-edge bg-ink px-1 py-0.5 text-chalk"
            >
              {[4, 8, 16].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.point.clip")}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={clipLimit}
              onChange={(event) => setClipLimit(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{clipLimit.toFixed(1)}</span>
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
        data-testid="reset-preview"
        onClick={() => {
          setOp("none");
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="point" />
    </section>
  );
}
