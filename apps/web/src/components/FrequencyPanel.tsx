import type { FrequencyFamily, FrequencyFilterOptions, FrequencyKind } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { SpectrumAnalysis } from "../workers/ip.worker";
import { SpectrumView } from "./SpectrumView";
import { TheoryPanel } from "./TheoryPanel";

const KINDS: FrequencyKind[] = ["low", "high", "band", "notch"];
const FAMILIES: FrequencyFamily[] = ["ideal", "butterworth", "gaussian"];

export function FrequencyPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [spectrum, setSpectrum] = useState<SpectrumAnalysis | null>(null);
  const [mode, setMode] = useState<"magnitude" | "phase">("magnitude");
  const [kind, setKind] = useState<FrequencyKind>("low");
  const [family, setFamily] = useState<FrequencyFamily>("gaussian");
  const [cutoff, setCutoff] = useState(0.25);
  const [bandWidth, setBandWidth] = useState(0.2);
  const [order, setOrder] = useState(2);
  const [notchX, setNotchX] = useState(0.35);
  const [notchY, setNotchY] = useState(0.35);
  const [notchRadius, setNotchRadius] = useState(0.15);
  const [applied, setApplied] = useState(false);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    setSpectrum(null);
    setApplied(false);
    setPreview(null);
    if (!image) return;
    let cancelled = false;
    workerRef.current ??= createIpWorker();
    workerRef.current.api
      .spectrum(image)
      .then((result) => {
        if (!cancelled) setSpectrum(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image, setPreview]);

  useEffect(() => {
    if (!image || !applied) return;
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const options: FrequencyFilterOptions = {
        kind,
        family,
        cutoff,
        width: bandWidth,
        order,
        notchX,
        notchY,
        notchRadius,
      };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyFrequency(image, options)
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
  }, [
    image,
    applied,
    kind,
    family,
    cutoff,
    bandWidth,
    order,
    notchX,
    notchY,
    notchRadius,
    setPreview,
  ]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const display = spectrum ? (mode === "magnitude" ? spectrum.magnitude : spectrum.phase) : null;

  return (
    <section className="flex flex-col gap-3">
      {spectrum && display && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate">
              {t("dock.frequency.spectrum")}
            </span>
            <div className="flex gap-1">
              {(["magnitude", "phase"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${
                    mode === option ? "border-safelight text-chalk" : "border-edge text-slate"
                  }`}
                >
                  {t(`dock.frequency.modes.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <SpectrumView data={display} width={spectrum.width} height={spectrum.height} />
        </div>
      )}

      <div className="grid grid-cols-4 gap-1">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`frequency-${option}`}
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] ${
              kind === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.frequency.kinds.${option}`)}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.frequency.family")}</span>
        <select
          value={family}
          onChange={(event) => setFamily(event.target.value as FrequencyFamily)}
          className="border border-edge bg-ink px-1 py-0.5 text-chalk"
        >
          {FAMILIES.map((option) => (
            <option key={option} value={option}>
              {t(`dock.frequency.families.${option}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.frequency.cutoff")}</span>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={cutoff}
          data-testid="cutoff-slider"
          onChange={(event) => setCutoff(Number(event.target.value))}
          className="w-28 accent-safelight"
        />
        <span className="numeric text-chalk">{cutoff.toFixed(2)}</span>
      </label>

      {kind === "band" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.frequency.width")}</span>
          <input
            type="range"
            min={0.05}
            max={0.6}
            step={0.01}
            value={bandWidth}
            onChange={(event) => setBandWidth(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{bandWidth.toFixed(2)}</span>
        </label>
      )}

      {family === "butterworth" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.frequency.order")}</span>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            className="w-28 accent-safelight"
          />
          <span className="numeric text-chalk">{order}</span>
        </label>
      )}

      {kind === "notch" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>x</span>
            <input
              type="range"
              min={-0.9}
              max={0.9}
              step={0.01}
              value={notchX}
              onChange={(event) => setNotchX(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{notchX.toFixed(2)}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>y</span>
            <input
              type="range"
              min={-0.9}
              max={0.9}
              step={0.01}
              value={notchY}
              onChange={(event) => setNotchY(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{notchY.toFixed(2)}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>r</span>
            <input
              type="range"
              min={0.03}
              max={0.4}
              step={0.01}
              value={notchRadius}
              onChange={(event) => setNotchRadius(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{notchRadius.toFixed(2)}</span>
          </label>
        </>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          data-testid="frequency-apply"
          onClick={() => setApplied(true)}
          className="rounded-sm border border-safelight px-2 py-1 text-[10px] text-chalk"
        >
          {t("dock.frequency.apply")}
        </button>
        <button
          type="button"
          data-testid="frequency-reset"
          onClick={() => {
            setApplied(false);
            setPreview(null);
          }}
          className="rounded-sm border border-edge px-2 py-1 text-[10px] text-slate hover:text-chalk"
        >
          {t("dock.reset")}
        </button>
      </div>

      <TheoryPanel topic="frequency" />
    </section>
  );
}
