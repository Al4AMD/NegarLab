import { type MorphologyOp, type StructuringShape, structuringElement } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { MorphologyRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

const OPS: MorphologyOp[] = ["erode", "dilate", "open", "close", "gradient", "tophat", "blackhat"];
const SHAPES: StructuringShape[] = ["rect", "ellipse", "cross"];
const SIZES = [3, 5, 7];

export function MorphologyPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [op, setOp] = useState<MorphologyOp>("erode");
  const [shape, setShape] = useState<StructuringShape>("rect");
  const [size, setSize] = useState(3);
  const [mask, setMask] = useState(() => Array.from(structuringElement(3, "rect").mask));
  const [binary, setBinary] = useState(false);
  const [threshold, setThreshold] = useState(128);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    setMask(Array.from(structuringElement(size, shape).mask));
  }, [size, shape]);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request: MorphologyRequest = {
        kind: op,
        size,
        shape,
        mask,
        binaryThreshold: binary ? threshold : undefined,
      };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyMorphology(image, request)
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
  }, [image, op, size, shape, mask, binary, threshold, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  function toggleCell(index: number) {
    setMask((current) => {
      const next = current.map((value, cell) => (cell === index ? (value ? 0 : 1) : value));
      return next.some(Boolean) ? next : current;
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1">
        {OPS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`morphology-${option}`}
            aria-pressed={op === option}
            onClick={() => setOp(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
              op === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.morphology.ops.${option}`)}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.morphology.shape")}</span>
        <select
          value={shape}
          onChange={(event) => setShape(event.target.value as StructuringShape)}
          className="border border-edge bg-ink px-1 py-0.5 text-chalk"
        >
          {SHAPES.map((option) => (
            <option key={option} value={option}>
              {t(`dock.morphology.shapes.${option}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.morphology.size")}</span>
        <select
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
          className="border border-edge bg-ink px-1 py-0.5 text-chalk"
        >
          {SIZES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate">{t("dock.morphology.mask")}</span>
        <div
          className="grid w-fit gap-0.5"
          style={{ gridTemplateColumns: `repeat(${size}, 1.25rem)` }}
        >
          {mask.map((active, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed structuring-element grid
              key={index}
              type="button"
              aria-label={t("dock.morphology.cell", { index: index + 1 })}
              aria-pressed={active === 1}
              onClick={() => toggleCell(index)}
              className={`h-5 w-5 border text-[8px] ${
                active
                  ? "border-safelight bg-safelight/30 text-chalk"
                  : "border-edge text-slate hover:text-chalk"
              }`}
            >
              {active ? "1" : "0"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[10px] text-slate">
        <input
          type="checkbox"
          checked={binary}
          onChange={(event) => setBinary(event.target.checked)}
          className="accent-safelight"
        />
        <span>{t("dock.morphology.binary")}</span>
      </label>

      {binary && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.morphology.threshold")}</span>
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{threshold}</span>
        </label>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="morphology-reset"
        onClick={() => {
          setMask(Array.from(structuringElement(size, shape).mask));
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="morphology" />
    </section>
  );
}
