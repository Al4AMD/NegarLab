import type { Plane, RgbaImage, RgbPlanes } from "./types";

export function rgbaToPlanes(image: RgbaImage): RgbPlanes {
  const count = image.width * image.height;
  const r = new Float32Array(count);
  const g = new Float32Array(count);
  const b = new Float32Array(count);
  for (let p = 0; p < count; p += 1) {
    const offset = p * 4;
    r[p] = (image.data[offset] ?? 0) / 255;
    g[p] = (image.data[offset + 1] ?? 0) / 255;
    b[p] = (image.data[offset + 2] ?? 0) / 255;
  }
  const plane = (data: Float32Array): Plane => ({
    width: image.width,
    height: image.height,
    data,
  });
  return { r: plane(r), g: plane(g), b: plane(b) };
}

export function planesToRgba(planes: RgbPlanes): RgbaImage {
  const { width, height } = planes.r;
  const count = width * height;
  const data = new Uint8ClampedArray(count * 4);
  for (let p = 0; p < count; p += 1) {
    const offset = p * 4;
    data[offset] = Math.round((planes.r.data[p] ?? 0) * 255);
    data[offset + 1] = Math.round((planes.g.data[p] ?? 0) * 255);
    data[offset + 2] = Math.round((planes.b.data[p] ?? 0) * 255);
    data[offset + 3] = 255;
  }
  return { width, height, data };
}
