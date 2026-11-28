import type { HalftoneMethod, PaletteMethod, PaletteResult, RgbaImage } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { HalftoneRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type HalftoneMode = "halftone" | "palette";

const MODES: HalftoneMode[] = ["halftone", "palette"];
const METHODS: HalftoneMethod[] = ["floyd-steinberg", "bayer"];
const PALETTE_METHODS: PaletteMethod[] = ["median-cut", "kmeans"];

function isPaletteResult(value: RgbaImage | PaletteResult): value is PaletteResult {
  return "palette" in value;
}

export function HalftonePanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [mode, setMode] = useState<HalftoneMode>("halftone");
  const [method, setMethod] = useState<HalftoneMethod>("floyd-steinberg");
  const [matrixSize, setMatrixSize] = useState(4);
  const [colors, setColors] = useState(8);
  const [paletteMethod, setPaletteMethod] = useState<PaletteMethod>("median-cut");
  const [dither, setDither] = useState(false);
  const [seed, setSeed] = useState(1);
  const [swatches, setSwatches] = useState<Array<[number, number, number]>>([]);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request: HalftoneRequest =
        mode === "halftone"
          ? { kind: "halftone", method, matrixSize }
          : { kind: "palette", colors, method: paletteMethod, dither, seed };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyHalftone(image, request)
        .then((result) => {
          if (cancelled) return;
          if (isPaletteResult(result)) {
            setSwatches(result.palette);
            setPreview(result.image);
          } else {
            setSwatches([]);
            setPreview(result);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, mode, method, matrixSize, colors, paletteMethod, dither, seed, setPreview]);

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
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`halftone-${option}`}
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
              mode === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.halftone.modes.${option}`)}
          </button>
        ))}
      </div>

      {mode === "halftone" ? (
        <>
          <div className="grid grid-cols-2 gap-1">
            {METHODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
                  method === option
                    ? "border-safelight text-chalk"
                    : "border-edge text-slate hover:text-chalk"
                }`}
              >
                {t(`dock.halftone.methods.${option === "floyd-steinberg" ? "floyd" : "bayer"}`)}
              </button>
            ))}
          </div>
          {method === "bayer" && (
            <div className="flex gap-1">
              {[2, 4, 8].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={matrixSize === value}
                  onClick={() => setMatrixSize(value)}
                  className={`numeric rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                    matrixSize === value
                      ? "border-safelight text-chalk"
                      : "border-edge text-slate hover:text-chalk"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.halftone.colors")}</span>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={colors}
              onChange={(event) => setColors(Number(event.target.value))}
              className="w-24 accent-safelight"
            />
            <span className="numeric w-6 text-end text-chalk">{colors}</span>
          </label>
          <div className="grid grid-cols-2 gap-1">
            {PALETTE_METHODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={paletteMethod === option}
                onClick={() => setPaletteMethod(option)}
                className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
                  paletteMethod === option
                    ? "border-safelight text-chalk"
                    : "border-edge text-slate hover:text-chalk"
                }`}
              >
                {t(
                  `dock.halftone.paletteMethods.${option === "median-cut" ? "medianCut" : "kmeans"}`,
                )}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[10px] text-slate">
            <input
              type="checkbox"
              checked={dither}
              onChange={(event) => setDither(event.target.checked)}
              className="accent-safelight"
            />
            <span>{t("dock.halftone.dither")}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.halftone.seed")}</span>
            <input
              type="number"
              min={0}
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value))}
              className="numeric w-16 border border-edge bg-ink px-1 py-0.5 text-chalk"
            />
          </label>
          {swatches.length > 0 && (
            <div className="flex flex-wrap gap-1" data-testid="halftone-swatches">
              {swatches.map((color, index) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: palette colors can repeat
                  key={index}
                  title={`rgb(${color[0]}, ${color[1]}, ${color[2]})`}
                  className="h-4 w-4 border border-edge"
                  style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="halftone-reset"
        onClick={() => {
          setSwatches([]);
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="halftone" />
    </section>
  );
}
