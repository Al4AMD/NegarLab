import type { NoiseKind, RgbaImage } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { denoiseNlm } from "../lib/denoise";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { RestoreRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type NoiseMode = "none" | NoiseKind;
type BlurMode = "none" | "motion" | "defocus";
type ViewMode = "noisy" | "blurred" | "restored";
type RestoreMode =
  | "none"
  | "median"
  | "bilateral"
  | "wiener-denoise"
  | "wiener"
  | "inverse"
  | "nlm";

const NOISE_KINDS: NoiseMode[] = ["none", "gaussian", "salt-pepper", "speckle", "poisson"];
const BLUR_KINDS: BlurMode[] = ["none", "motion", "defocus"];
const VIEWS: ViewMode[] = ["noisy", "blurred", "restored"];
const RESTORES: RestoreMode[] = [
  "none",
  "median",
  "bilateral",
  "wiener-denoise",
  "wiener",
  "inverse",
  "nlm",
];

export function NoisePanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [noiseKind, setNoiseKind] = useState<NoiseMode>("gaussian");
  const [amount, setAmount] = useState(0.05);
  const [seed, setSeed] = useState(1);
  const [blurKind, setBlurKind] = useState<BlurMode>("none");
  const [length, setLength] = useState(9);
  const [angle, setAngle] = useState(0);
  const [radius, setRadius] = useState(3);
  const [view, setView] = useState<ViewMode>("noisy");
  const [restore, setRestore] = useState<RestoreMode>("none");
  const [sigmaSpace, setSigmaSpace] = useState(2);
  const [sigmaRange, setSigmaRange] = useState(0.1);
  const [denoiseStrength, setDenoiseStrength] = useState(0.02);
  const [deconvStrength, setDeconvStrength] = useState(0.01);
  const [nlmStrength, setNlmStrength] = useState(3);
  const [noisy, setNoisy] = useState<RgbaImage | null>(null);
  const [working, setWorking] = useState<RgbaImage | null>(null);
  const [restored, setRestored] = useState<RgbaImage | null>(null);
  const [nlmResult, setNlmResult] = useState<RgbaImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    if (!image || (noiseKind === "none" && blurKind === "none" && restore === "none")) {
      setNoisy(null);
      setWorking(null);
      setRestored(null);
      setNlmResult(null);
      setPreview(null);
      return;
    }
    setFailed(false);
    setNlmResult(null);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        workerRef.current ??= createIpWorker();
        const api = workerRef.current.api;
        const noisyImage =
          noiseKind === "none"
            ? image
            : await api.applyNoise(image, { kind: noiseKind, amount, seed });
        if (cancelled) return;
        const workingImage =
          blurKind === "none"
            ? noisyImage
            : await api.blur(noisyImage, blurKind, length, angle, radius);
        if (cancelled) return;
        setNoisy(noisyImage);
        setWorking(workingImage);
        if (restore === "none" || restore === "nlm") {
          setRestored(null);
          return;
        }
        const request: RestoreRequest =
          restore === "median"
            ? { kind: "median", radius }
            : restore === "bilateral"
              ? { kind: "bilateral", radius, sigmaSpace, sigmaRange }
              : restore === "wiener-denoise"
                ? { kind: "wiener-denoise", strength: denoiseStrength }
                : {
                    kind: restore,
                    blur: blurKind === "defocus" ? "defocus" : "motion",
                    length,
                    angle,
                    radius,
                    strength: deconvStrength,
                  };
        const result = await api.restore(workingImage, request);
        if (!cancelled) setRestored(result);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    image,
    noiseKind,
    amount,
    seed,
    blurKind,
    length,
    angle,
    radius,
    restore,
    sigmaSpace,
    sigmaRange,
    denoiseStrength,
    deconvStrength,
    setPreview,
  ]);

  useEffect(() => {
    const shown =
      view === "noisy" ? noisy : view === "blurred" ? working : (nlmResult ?? restored ?? working);
    setPreview(shown);
  }, [view, noisy, working, restored, nlmResult, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  async function runNlm() {
    if (!working) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await denoiseNlm(working, nlmStrength);
      setNlmResult(result);
      setView("restored");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {NOISE_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`noise-${option}`}
            aria-pressed={noiseKind === option}
            onClick={() => setNoiseKind(option)}
            className={`rounded-sm border px-1.5 py-0.5 text-[9px] transition-colors ${
              noiseKind === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.noise.kinds.${option === "salt-pepper" ? "saltPepper" : option}`)}
          </button>
        ))}
      </div>

      {noiseKind !== "none" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.noise.amount")}</span>
            <input
              type="range"
              min={0.01}
              max={0.3}
              step={0.01}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{amount.toFixed(2)}</span>
          </label>
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.noise.seed")}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
                className="numeric w-16 border border-edge bg-ink px-1 py-0.5 text-chalk"
              />
              <button
                type="button"
                onClick={() => setSeed((value) => value + 1)}
                className="rounded-sm border border-edge px-1.5 py-0.5 text-slate transition-colors hover:text-chalk"
              >
                {t("dock.noise.reroll")}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-1">
        {BLUR_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={blurKind === option}
            onClick={() => setBlurKind(option)}
            className={`rounded-sm border px-1.5 py-0.5 text-[9px] transition-colors ${
              blurKind === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.noise.blurs.${option}`)}
          </button>
        ))}
      </div>

      {blurKind === "motion" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.noise.length")}</span>
            <input
              type="range"
              min={3}
              max={31}
              step={2}
              value={length}
              onChange={(event) => setLength(Number(event.target.value))}
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{length}</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.noise.angle")}</span>
            <input
              type="range"
              min={0}
              max={180}
              step={1}
              value={angle}
              onChange={(event) => setAngle(Number(event.target.value))}
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{angle}</span>
          </label>
        </>
      )}

      {blurKind === "defocus" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.noise.radius")}</span>
          <input
            type="range"
            min={1}
            max={9}
            step={1}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-24 accent-safelight"
          />
          <span className="numeric w-8 text-end text-chalk">{radius}</span>
        </label>
      )}

      <div className="flex flex-wrap gap-1">
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`noise-view-${option}`}
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={`rounded-sm border px-1.5 py-0.5 text-[9px] transition-colors ${
              view === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.noise.views.${option}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {RESTORES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={restore === option}
            onClick={() => setRestore(option)}
            className={`rounded-sm border px-1.5 py-0.5 text-[9px] transition-colors ${
              restore === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.noise.restores.${option === "wiener-denoise" ? "wienerDenoise" : option}`)}
          </button>
        ))}
      </div>

      {(restore === "median" || restore === "bilateral") && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.noise.radius")}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-24 accent-safelight"
          />
          <span className="numeric w-8 text-end text-chalk">{radius}</span>
        </label>
      )}

      {restore === "bilateral" && (
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
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{sigmaSpace.toFixed(1)}</span>
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
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{sigmaRange.toFixed(2)}</span>
          </label>
        </>
      )}

      {restore === "wiener-denoise" && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.noise.strength")}</span>
          <input
            type="range"
            min={0.005}
            max={0.05}
            step={0.005}
            value={denoiseStrength}
            onChange={(event) => setDenoiseStrength(Number(event.target.value))}
            className="w-24 accent-safelight"
          />
          <span className="numeric w-10 text-end text-chalk">{denoiseStrength.toFixed(3)}</span>
        </label>
      )}

      {(restore === "wiener" || restore === "inverse") && (
        <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
          <span>{t("dock.noise.strength")}</span>
          <input
            type="range"
            min={0.001}
            max={0.05}
            step={0.001}
            value={deconvStrength}
            onChange={(event) => setDeconvStrength(Number(event.target.value))}
            className="w-24 accent-safelight"
          />
          <span className="numeric w-10 text-end text-chalk">{deconvStrength.toFixed(3)}</span>
        </label>
      )}

      {restore === "nlm" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.noise.nlmStrength")}</span>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={nlmStrength}
              onChange={(event) => setNlmStrength(Number(event.target.value))}
              className="w-24 accent-safelight"
            />
            <span className="numeric w-8 text-end text-chalk">{nlmStrength}</span>
          </label>
          <button
            type="button"
            data-testid="noise-nlm"
            disabled={busy || !working}
            onClick={() => void runNlm()}
            className="self-start rounded-sm border border-safelight px-2 py-1 text-[10px] text-chalk transition-colors disabled:opacity-40"
          >
            {busy ? t("dock.noise.busy") : t("dock.noise.runNlm")}
          </button>
        </>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t(restore === "nlm" ? "dock.noise.nlmFailed" : "dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="noise-reset"
        onClick={() => {
          setNoiseKind("none");
          setBlurKind("none");
          setRestore("none");
          setView("noisy");
          setNoisy(null);
          setWorking(null);
          setRestored(null);
          setNlmResult(null);
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="noise" />
    </section>
  );
}
