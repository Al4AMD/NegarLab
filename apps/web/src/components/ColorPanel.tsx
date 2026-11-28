import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { ColorRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

type ColorMode = "space" | "subsample" | "colorblind" | "balance";

const MODES: ColorMode[] = ["space", "subsample", "colorblind", "balance"];
const SPACES = ["rgb", "hsv", "hsl", "ycbcr", "cmyk", "lab", "gray"] as const;
type ColorSpace = (typeof SPACES)[number];
const CHROMA = ["4:4:4", "4:2:2", "4:2:0"] as const;
const DEFICIENCIES = ["protanopia", "deuteranopia", "tritanopia"] as const;
const BALANCE = ["gray-world", "white-patch"] as const;

function channelCount(space: ColorSpace): number {
  if (space === "cmyk") return 4;
  if (space === "gray") return 1;
  return 3;
}

export function ColorPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [mode, setMode] = useState<ColorMode>("space");
  const [space, setSpace] = useState<ColorSpace>("hsv");
  const [channel, setChannel] = useState(-1);
  const [chroma, setChroma] = useState<(typeof CHROMA)[number]>("4:2:0");
  const [deficiency, setDeficiency] = useState<(typeof DEFICIENCIES)[number]>("deuteranopia");
  const [severity, setSeverity] = useState(1);
  const [balance, setBalance] = useState<(typeof BALANCE)[number]>("gray-world");
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
      const request: ColorRequest =
        mode === "space"
          ? { kind: "space", space, channel }
          : mode === "subsample"
            ? { kind: "subsample", mode: chroma }
            : mode === "colorblind"
              ? { kind: "colorblind", deficiency, severity }
              : { kind: "balance", method: balance };
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyColor(image, request)
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
  }, [image, mode, space, channel, chroma, deficiency, severity, balance, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const channels = channelCount(space);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`color-${option}`}
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`rounded-sm border px-1 py-1 text-[9px] transition-colors ${
              mode === option
                ? "border-safelight text-chalk"
                : "border-edge text-slate hover:text-chalk"
            }`}
          >
            {t(`dock.color.modes.${option}`)}
          </button>
        ))}
      </div>

      {mode === "space" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.color.space")}</span>
            <select
              value={space}
              onChange={(event) => {
                setSpace(event.target.value as ColorSpace);
                setChannel(-1);
              }}
              className="border border-edge bg-ink px-1 py-0.5 text-chalk"
            >
              {SPACES.map((option) => (
                <option key={option} value={option}>
                  {t(`dock.color.spaces.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              data-testid="color-channel-all"
              aria-pressed={channel === -1}
              onClick={() => setChannel(-1)}
              className={`rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                channel === -1
                  ? "border-safelight text-chalk"
                  : "border-edge text-slate hover:text-chalk"
              }`}
            >
              {t("dock.color.all")}
            </button>
            {Array.from({ length: channels }, (_, index) => index).map((index) => (
              <button
                key={index}
                type="button"
                aria-pressed={channel === index}
                onClick={() => setChannel(index)}
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                  channel === index
                    ? "border-safelight text-chalk"
                    : "border-edge text-slate hover:text-chalk"
                }`}
              >
                <span className="numeric">{index + 1}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "subsample" && (
        <div className="flex gap-1">
          {CHROMA.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={chroma === option}
              onClick={() => setChroma(option)}
              className={`numeric rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                chroma === option
                  ? "border-safelight text-chalk"
                  : "border-edge text-slate hover:text-chalk"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {mode === "colorblind" && (
        <>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.color.deficiency")}</span>
            <select
              value={deficiency}
              onChange={(event) =>
                setDeficiency(event.target.value as (typeof DEFICIENCIES)[number])
              }
              className="border border-edge bg-ink px-1 py-0.5 text-chalk"
            >
              {DEFICIENCIES.map((option) => (
                <option key={option} value={option}>
                  {t(`dock.color.deficiencies.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
            <span>{t("dock.color.severity")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={severity}
              onChange={(event) => setSeverity(Number(event.target.value))}
              className="w-28 accent-safelight"
            />
            <span className="numeric text-chalk">{severity.toFixed(2)}</span>
          </label>
        </>
      )}

      {mode === "balance" && (
        <div className="flex gap-1">
          {BALANCE.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={balance === option}
              onClick={() => setBalance(option)}
              className={`rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                balance === option
                  ? "border-safelight text-chalk"
                  : "border-edge text-slate hover:text-chalk"
              }`}
            >
              {t(`dock.color.methods.${option === "gray-world" ? "grayWorld" : "whitePatch"}`)}
            </button>
          ))}
        </div>
      )}

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="color-reset"
        onClick={() => setPreview(null)}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="color" />
    </section>
  );
}
