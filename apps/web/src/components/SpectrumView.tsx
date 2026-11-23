import { useEffect, useRef } from "react";

export function SpectrumView({
  data,
  width,
  height,
}: {
  data: Float32Array;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const value = Math.round(Math.min(1, Math.max(0, data[i] ?? 0)) * 255);
      pixels[i * 4] = value;
      pixels[i * 4 + 1] = value;
      pixels[i * 4 + 2] = value;
      pixels[i * 4 + 3] = 255;
    }
    context.putImageData(new ImageData(pixels, width, height), 0, 0);
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="spectrum-view"
      className="block w-full border border-edge [image-rendering:pixelated]"
      aria-label="spectrum"
    />
  );
}
