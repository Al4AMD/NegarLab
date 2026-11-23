import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { DEMO_IMAGES, useImageStore } from "../lib/imageStore";
import { ApertureMark } from "./Icons";

const CORNERS = [
  "-start-px -top-px border-s-2 border-t-2",
  "-end-px -top-px border-e-2 border-t-2",
  "-start-px -bottom-px border-s-2 border-b-2",
  "-end-px -bottom-px border-e-2 border-b-2",
];

function ImageCanvas() {
  const image = useImageStore((state) => state.image);
  const selectPixel = useImageStore((state) => state.selectPixel);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = new Uint8ClampedArray(image.data.length);
    pixels.set(image.data);
    context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
  }, [image]);

  if (!image) return null;

  return (
    <div
      className="border border-edge p-2"
      style={{
        backgroundImage: "repeating-conic-gradient(#2C3138 0% 25%, #1E2227 0% 50%)",
        backgroundSize: "16px 16px",
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="stage-image"
        aria-label="loaded image"
        className="mx-auto block max-h-[62vh] w-auto max-w-full cursor-crosshair"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.floor(((event.clientX - rect.left) / rect.width) * image.width);
          const y = Math.floor(((event.clientY - rect.top) / rect.height) * image.height);
          selectPixel(
            Math.min(image.width - 1, Math.max(0, x)),
            Math.min(image.height - 1, Math.max(0, y)),
          );
        }}
      />
    </div>
  );
}

export function Stage() {
  const { t } = useTranslation();
  const image = useImageStore((state) => state.image);
  const label = useImageStore((state) => state.label);
  const loading = useImageStore((state) => state.loading);
  const errorKey = useImageStore((state) => state.errorKey);
  const loadDemo = useImageStore((state) => state.loadDemo);
  const loadFile = useImageStore((state) => state.loadFile);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <main
      className="flex min-h-[46vh] flex-col items-center justify-center gap-4 border-edge p-4 lg:min-h-0 lg:p-8"
      aria-label={t("stage.aria")}
      data-testid="stage"
    >
      {image ? (
        <>
          <ImageCanvas />
          <p className="text-xs text-slate">
            {label} ·{" "}
            <span className="numeric">
              {image.width}×{image.height}
            </span>
          </p>
        </>
      ) : (
        <div className="relative w-full max-w-xl border border-edge bg-panel px-6 py-10 text-center">
          {CORNERS.map((corner) => (
            <span
              key={corner}
              aria-hidden="true"
              className={`absolute size-3 border-safelight ${corner}`}
            />
          ))}
          <ApertureMark className="mx-auto size-10 text-slate" />
          <h2 className="mt-4 font-display text-lg">{t("stage.empty.title")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate">
            {t("stage.empty.body")}
          </p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-slate">
            {t("stage.demoLabel")}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {DEMO_IMAGES.map((name) => (
              <button
                key={name}
                type="button"
                data-testid={`demo-${name}`}
                onClick={() => void loadDemo(name)}
                className="rounded-sm border border-edge px-3 py-1.5 text-xs text-chalk transition-colors hover:border-safelight"
              >
                {t(`stage.demos.${name}`)}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 text-xs text-slate underline decoration-edge underline-offset-4 hover:text-chalk"
          >
            {t("stage.upload")}
          </button>
        </div>
      )}

      {loading && (
        <p role="status" className="text-xs text-slate">
          {t("stage.loading")}
        </p>
      )}
      {errorKey && (
        <p role="alert" className="text-xs text-safelight">
          {t(errorKey)}
        </p>
      )}
    </main>
  );
}
