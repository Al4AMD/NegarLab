import type { Interpolation } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { GeometryRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type GeometryMode = "transform" | "pyramid" | "blend";

const MODES: GeometryMode[] = ["transform", "pyramid", "blend"];
const INTERPOLATIONS: Interpolation[] = ["nearest", "bilinear", "bicubic", "lanczos"];

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 accent-safelight"
      />
      <span className="numeric w-9 text-end text-chalk">{format ? format(value) : value}</span>
    </label>
  );
}

export function GeometryPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [mode, setMode] = useState<GeometryMode>("transform");
  const [interpolation, setInterpolation] = useState<Interpolation>("bilinear");
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [shearX, setShearX] = useState(0);
  const [shearY, setShearY] = useState(0);
  const [perspectiveX, setPerspectiveX] = useState(0);
  const [perspectiveY, setPerspectiveY] = useState(0);
  const [levels, setLevels] = useState(3);
  const [laplacian, setLaplacian] = useState(false);
  const [mix, setMix] = useState(0.5);
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
      const request: GeometryRequest =
        mode === "transform"
          ? {
              kind: "transform",
              options: {
                scaleX,
                scaleY,
                rotate,
                translateX,
                translateY,
                shearX,
                shearY,
                perspectiveX,
                perspectiveY,
                interpolation,
              },
            }
          : mode === "pyramid"
            ? { kind: "pyramid", levels, laplacian }
            : { kind: "blend", levels, mix };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyGeometry(image, request)
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
    mode,
    interpolation,
    scaleX,
    scaleY,
    rotate,
    translateX,
    translateY,
    shearX,
    shearY,
    perspectiveX,
    perspectiveY,
    levels,
    laplacian,
    mix,
    setPreview,
  ]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`geometry-${option}`}
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
              mode === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.geometry.modes.${option}`)}
          </button>
        ))}
      </div>

      {mode === "transform" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.geometry.interpolation")}</span>
            <select
              value={interpolation}
              onChange={(event) => setInterpolation(event.target.value as Interpolation)}
              className="border border-edge bg-ink px-1 py-0.5 text-chalk"
            >
              {INTERPOLATIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`dock.geometry.interpolations.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="sx"
            value={scaleX}
            min={0.5}
            max={2}
            step={0.05}
            format={(value) => value.toFixed(2)}
            onChange={setScaleX}
          />
          <Slider
            label="sy"
            value={scaleY}
            min={0.5}
            max={2}
            step={0.05}
            format={(value) => value.toFixed(2)}
            onChange={setScaleY}
          />
          <Slider
            label={t("dock.geometry.rotate")}
            value={rotate}
            min={-180}
            max={180}
            step={1}
            onChange={setRotate}
          />
          <Slider
            label="tx"
            value={translateX}
            min={-64}
            max={64}
            step={1}
            onChange={setTranslateX}
          />
          <Slider
            label="ty"
            value={translateY}
            min={-64}
            max={64}
            step={1}
            onChange={setTranslateY}
          />
          <Slider
            label="shx"
            value={shearX}
            min={-1}
            max={1}
            step={0.05}
            format={(value) => value.toFixed(2)}
            onChange={setShearX}
          />
          <Slider
            label="shy"
            value={shearY}
            min={-1}
            max={1}
            step={0.05}
            format={(value) => value.toFixed(2)}
            onChange={setShearY}
          />
          <Slider
            label="px"
            value={perspectiveX}
            min={-0.002}
            max={0.002}
            step={0.0002}
            format={(value) => value.toFixed(4)}
            onChange={setPerspectiveX}
          />
          <Slider
            label="py"
            value={perspectiveY}
            min={-0.002}
            max={0.002}
            step={0.0002}
            format={(value) => value.toFixed(4)}
            onChange={setPerspectiveY}
          />
        </>
      )}

      {mode !== "transform" && (
        <>
          <Slider
            label={t("dock.geometry.levels")}
            value={levels}
            min={2}
            max={4}
            step={1}
            onChange={setLevels}
          />
          {mode === "pyramid" && (
            <label className="flex items-center gap-2 text-[10px] text-slate">
              <input
                type="checkbox"
                checked={laplacian}
                onChange={(event) => setLaplacian(event.target.checked)}
                className="accent-safelight"
              />
              <span>{t("dock.geometry.laplacian")}</span>
            </label>
          )}
          {mode === "blend" && (
            <Slider
              label={t("dock.geometry.mix")}
              value={mix}
              min={0}
              max={1}
              step={0.05}
              format={(value) => value.toFixed(2)}
              onChange={setMix}
            />
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
        data-testid="geometry-reset"
        onClick={() => {
          setScaleX(1);
          setScaleY(1);
          setRotate(0);
          setTranslateX(0);
          setTranslateY(0);
          setShearX(0);
          setShearY(0);
          setPerspectiveX(0);
          setPerspectiveY(0);
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="geometry" />
    </section>
  );
}
