import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import type { OpRequest } from "../workers/ip.worker";
import { TheoryPanel } from "./TheoryPanel";

export function SamplingPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [bits, setBits] = useState(8);
  const [factor, setFactor] = useState(1);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    if (!image || (bits === 8 && factor === 1)) {
      setPreview(null);
      return;
    }
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const ops: OpRequest[] = [];
      if (bits < 8) ops.push({ kind: "quantize", bits });
      if (factor > 1) ops.push({ kind: "resize", factor });
      workerRef.current ??= createIpWorker();
      workerRef.current.api
        .applyOps(image, ops)
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
  }, [image, bits, factor, setPreview]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return (
    <section className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.sampling.bits")}</span>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={bits}
          data-testid="bits-slider"
          onChange={(event) => setBits(Number(event.target.value))}
          className="w-28 accent-safelight"
        />
        <span className="numeric text-chalk">{bits}</span>
      </label>

      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.sampling.downsample")}</span>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={factor}
          data-testid="resize-slider"
          onChange={(event) => setFactor(Number(event.target.value))}
          className="w-28 accent-safelight"
        />
        <span className="numeric text-chalk">{factor}x</span>
      </label>

      {failed && (
        <p role="alert" className="text-xs text-safelight">
          {t("dock.error")}
        </p>
      )}

      <button
        type="button"
        data-testid="sampling-reset"
        onClick={() => {
          setBits(8);
          setFactor(1);
          setPreview(null);
        }}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="sampling" />
    </section>
  );
}
