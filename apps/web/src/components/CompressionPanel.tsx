import type { JpegBlockStages, JpegChannel, JpegResult, LosslessReport } from "@negarlab/ip";
import { dctBasis } from "@negarlab/ip";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageStore } from "../lib/imageStore";
import { createIpWorker, type IpWorkerHandle } from "../lib/ipClient";
import { TheoryPanel } from "./TheoryPanel";

const CHANNELS: JpegChannel[] = ["y", "cb", "cr"];
const CELL_KEYS = Array.from({ length: 64 }, (_, index) => `cell-${index}`);
const BASES = Array.from({ length: 64 }, (_, index) => dctBasis(index % 8, Math.floor(index / 8)));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function Matrix({ values, testId }: { values: ArrayLike<number>; testId: string }) {
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-8 gap-px border border-edge bg-edge text-center text-[7px] leading-3"
    >
      {Array.from(values).map((value, index) => (
        <span key={CELL_KEYS[index]} className="bg-ink px-0.5 py-0.5 numeric text-chalk">
          {Math.round(value)}
        </span>
      ))}
    </div>
  );
}

export function CompressionPanel() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const setPreview = useImageStore((state) => state.setPreview);
  const [quality, setQuality] = useState(50);
  const [result, setResult] = useState<JpegResult | null>(null);
  const [report, setReport] = useState<LosslessReport | null>(null);
  const [channel, setChannel] = useState<JpegChannel>("y");
  const [blockX, setBlockX] = useState(0);
  const [blockY, setBlockY] = useState(0);
  const [block, setBlock] = useState<JpegBlockStages | null>(null);
  const [failed, setFailed] = useState(false);
  const workerRef = useRef<IpWorkerHandle | null>(null);

  useEffect(() => {
    if (!image) {
      setResult(null);
      setReport(null);
      setPreview(null);
      return;
    }
    setFailed(false);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      workerRef.current ??= createIpWorker();
      Promise.all([
        workerRef.current.api.compressJpeg(image, quality),
        workerRef.current.api.lossless(image),
      ])
        .then(([compressed, lossless]) => {
          if (cancelled) return;
          setResult(compressed);
          setReport(lossless);
          setPreview(compressed.image);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, quality, setPreview]);

  useEffect(() => {
    if (!image) {
      setBlock(null);
      return;
    }
    let cancelled = false;
    workerRef.current ??= createIpWorker();
    workerRef.current.api
      .jpegBlock(image, blockX, blockY, quality, channel)
      .then((stages) => {
        if (!cancelled) setBlock(stages);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image, blockX, blockY, quality, channel]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const maxBlocksX = image ? Math.ceil(image.width / 8) : 1;
  const maxBlocksY = image ? Math.ceil(image.height / 8) : 1;

  return (
    <section className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-2 text-[10px] text-slate">
        <span>{t("dock.compression.quality")}</span>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={quality}
          data-testid="compression-quality"
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

      {result && (
        <dl
          data-testid="compression-stats"
          className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]"
        >
          <dt className="text-slate">{t("dock.compression.encoded")}</dt>
          <dd className="numeric">{formatBytes(result.encodedBytes)}</dd>
          <dt className="text-slate">{t("dock.compression.bpp")}</dt>
          <dd className="numeric">{result.bpp.toFixed(2)}</dd>
          <dt className="text-slate">{t("dock.compression.ratio")}</dt>
          <dd className="numeric">{result.ratio.toFixed(2)}×</dd>
        </dl>
      )}

      {report && (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="text-[10px] uppercase tracking-[0.16em] text-slate">
              {t("dock.compression.lossless")}
            </h3>
            <span className="numeric text-[10px] text-slate">
              H = {report.entropyBits.toFixed(2)} bpp
            </span>
          </div>
          <table data-testid="lossless-table" className="w-full text-[10px]">
            <thead>
              <tr className="text-slate">
                <th className="text-start font-normal">{t("dock.compression.method")}</th>
                <th className="text-end font-normal">{t("dock.compression.bytes")}</th>
                <th className="text-end font-normal">{t("dock.compression.savings")}</th>
              </tr>
            </thead>
            <tbody>
              {report.methods.map((method) => (
                <tr key={method.id}>
                  <td>{t(`dock.compression.methods.${method.id}`)}</td>
                  <td className="numeric text-end">{formatBytes(method.encodedBytes)}</td>
                  <td className="numeric text-end">
                    {(100 - (method.encodedBytes / Math.max(1, report.rawBytes)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <details>
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.16em] text-slate">
            {t("dock.compression.quantTable")}
          </summary>
          <div className="mt-2">
            <Matrix values={result.lumaTable} testId="quant-table" />
          </div>
        </details>
      )}

      <details>
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.16em] text-slate">
          {t("dock.compression.basis")}
        </summary>
        <div data-testid="basis-grid" className="mt-2 grid grid-cols-8 gap-1">
          {BASES.map((basis, index) => (
            <div key={CELL_KEYS[index]} className="grid grid-cols-8 gap-px bg-edge">
              {Array.from(basis).map((value, cell) => (
                <span
                  key={CELL_KEYS[cell]}
                  title={value.toFixed(3)}
                  className="aspect-square"
                  style={{
                    backgroundColor:
                      value >= 0
                        ? `rgba(231, 228, 220, ${Math.min(1, value * 5)})`
                        : `rgba(214, 92, 69, ${Math.min(1, -value * 5)})`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </details>

      <details open>
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.16em] text-slate">
          {t("dock.compression.block")}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {CHANNELS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={channel === option}
                onClick={() => setChannel(option)}
                className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${
                  channel === option ? "border-safelight text-chalk" : "border-edge text-slate"
                }`}
              >
                {t(`dock.compression.channels.${option}`)}
              </button>
            ))}
            <label className="ms-auto flex items-center gap-1 text-[9px] text-slate">
              x
              <input
                type="number"
                min={0}
                max={maxBlocksX - 1}
                value={blockX}
                onChange={(event) => setBlockX(Number(event.target.value))}
                className="w-12 border border-edge bg-ink px-1 py-0.5 text-chalk"
              />
            </label>
            <label className="flex items-center gap-1 text-[9px] text-slate">
              y
              <input
                type="number"
                min={0}
                max={maxBlocksY - 1}
                value={blockY}
                onChange={(event) => setBlockY(Number(event.target.value))}
                className="w-12 border border-edge bg-ink px-1 py-0.5 text-chalk"
              />
            </label>
          </div>

          {block && (
            <div data-testid="jpeg-block" className="flex flex-col gap-2">
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.source")}</p>
                <Matrix values={block.source} testId="block-source" />
              </div>
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.levelShifted")}</p>
                <Matrix values={block.levelShifted} testId="block-level-shifted" />
              </div>
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.dct")}</p>
                <Matrix values={block.dct} testId="block-dct" />
              </div>
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.quantized")}</p>
                <Matrix values={block.quantized} testId="block-quantized" />
              </div>
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.zigzag")}</p>
                <Matrix values={block.zigzag} testId="block-zigzag" />
              </div>
              <div>
                <p className="mb-1 text-[9px] text-slate">{t("dock.compression.reconstructed")}</p>
                <Matrix values={block.reconstructed} testId="block-reconstructed" />
              </div>
              <p className="text-[9px] text-slate">
                {t("dock.compression.dcDiff")}:{" "}
                <span className="numeric text-chalk">{block.dcDiff}</span>
              </p>
              <p className="text-[9px] leading-4 text-slate">
                {t("dock.compression.rle")}:{" "}
                <span className="numeric text-chalk">
                  {block.rle
                    .slice(0, 10)
                    .map((entry) => `${entry.run}/${entry.size}`)
                    .join(" ")}
                  {block.rle.length > 10 ? " …" : ""}
                </span>
              </p>
            </div>
          )}
        </div>
      </details>

      <button
        type="button"
        data-testid="compression-reset"
        onClick={() => setPreview(null)}
        className="self-start rounded-sm border border-edge px-2 py-1 text-[10px] text-slate transition-colors hover:text-chalk"
      >
        {t("dock.reset")}
      </button>

      <TheoryPanel topic="compression" />
    </section>
  );
}
