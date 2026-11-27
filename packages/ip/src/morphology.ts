import type { RgbaImage } from "./types";

export type MorphologyOp =
  | "erode"
  | "dilate"
  | "open"
  | "close"
  | "gradient"
  | "tophat"
  | "blackhat";

export type StructuringShape = "rect" | "ellipse" | "cross";

export interface StructuringElement {
  readonly size: number;
  readonly mask: Uint8Array;
}

export function structuringElement(size: number, shape: StructuringShape): StructuringElement {
  if (!Number.isInteger(size) || size < 1 || size > 9 || size % 2 === 0) {
    throw new RangeError("size must be an odd integer in 1..9");
  }
  const mask = new Uint8Array(size * size);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let active: boolean;
      if (shape === "rect") {
        active = true;
      } else if (shape === "cross") {
        active = x === center || y === center;
      } else {
        const dx = center === 0 ? 0 : (x - center) / center;
        const dy = center === 0 ? 0 : (y - center) / center;
        active = dx * dx + dy * dy <= 1;
      }
      mask[y * size + x] = active ? 1 : 0;
    }
  }
  return { size, mask };
}

function clampIndex(value: number, limit: number): number {
  return Math.min(limit - 1, Math.max(0, value));
}

function extractChannel(image: RgbaImage, channel: number): Uint8ClampedArray {
  const plane = new Uint8ClampedArray(image.width * image.height);
  for (let i = 0; i < plane.length; i += 1) {
    plane[i] = image.data[i * 4 + channel] ?? 0;
  }
  return plane;
}

function lumaPlane(image: RgbaImage): Uint8ClampedArray {
  const plane = new Uint8ClampedArray(image.width * image.height);
  for (let i = 0; i < plane.length; i += 1) {
    const offset = i * 4;
    plane[i] = Math.round(
      0.299 * (image.data[offset] ?? 0) +
        0.587 * (image.data[offset + 1] ?? 0) +
        0.114 * (image.data[offset + 2] ?? 0),
    );
  }
  return plane;
}

function rankFilter(
  plane: Uint8ClampedArray,
  width: number,
  height: number,
  se: StructuringElement,
  takeMin: boolean,
): Uint8ClampedArray {
  const { size, mask } = se;
  const half = Math.floor(size / 2);
  const out = new Uint8ClampedArray(plane.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let result = takeMin ? 255 : 0;
      let seen = false;
      for (let ky = 0; ky < size; ky += 1) {
        for (let kx = 0; kx < size; kx += 1) {
          if (mask[ky * size + kx] !== 1) continue;
          const sourceY = clampIndex(y + ky - half, height);
          const sourceX = clampIndex(x + kx - half, width);
          const value = plane[sourceY * width + sourceX] ?? 0;
          result = takeMin ? Math.min(result, value) : Math.max(result, value);
          seen = true;
        }
      }
      out[y * width + x] = seen ? result : (plane[y * width + x] ?? 0);
    }
  }
  return out;
}

function erodePlane(plane: Uint8ClampedArray, width: number, height: number, se: StructuringElement) {
  return rankFilter(plane, width, height, se, true);
}

function dilatePlane(plane: Uint8ClampedArray, width: number, height: number, se: StructuringElement) {
  return rankFilter(plane, width, height, se, false);
}

function subtractPlane(a: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 1) {
    out[i] = Math.max(0, (a[i] ?? 0) - (b[i] ?? 0));
  }
  return out;
}

function runOp(
  planes: Uint8ClampedArray[],
  width: number,
  height: number,
  op: MorphologyOp,
  se: StructuringElement,
): Uint8ClampedArray[] {
  switch (op) {
    case "erode":
      return planes.map((plane) => erodePlane(plane, width, height, se));
    case "dilate":
      return planes.map((plane) => dilatePlane(plane, width, height, se));
    case "open":
      return planes.map((plane) =>
        dilatePlane(erodePlane(plane, width, height, se), width, height, se),
      );
    case "close":
      return planes.map((plane) =>
        erodePlane(dilatePlane(plane, width, height, se), width, height, se),
      );
    case "gradient":
      return planes.map((plane) =>
        subtractPlane(
          dilatePlane(plane, width, height, se),
          erodePlane(plane, width, height, se),
        ),
      );
    case "tophat":
      return planes.map((plane) =>
        subtractPlane(
          plane,
          dilatePlane(erodePlane(plane, width, height, se), width, height, se),
        ),
      );
    case "blackhat":
      return planes.map((plane) =>
        subtractPlane(
          erodePlane(dilatePlane(plane, width, height, se), width, height, se),
          plane,
        ),
      );
  }
}

export function applyMorphology(
  image: RgbaImage,
  op: MorphologyOp,
  se: StructuringElement,
  binaryThreshold?: number,
): RgbaImage {
  if (se.mask.length !== se.size * se.size) {
    throw new RangeError("mask length does not match size");
  }
  if (se.size < 1 || se.size % 2 === 0) {
    throw new RangeError("size must be an odd positive integer");
  }
  const { width, height } = image;
  const binary = binaryThreshold !== undefined;
  let planes: Uint8ClampedArray[];
  if (binary) {
    const luma = lumaPlane(image);
    const thresholded = new Uint8ClampedArray(luma.length);
    for (let i = 0; i < luma.length; i += 1) {
      thresholded[i] = (luma[i] ?? 0) >= binaryThreshold ? 255 : 0;
    }
    planes = runOp([thresholded], width, height, op, se);
  } else {
    planes = runOp(
      [extractChannel(image, 0), extractChannel(image, 1), extractChannel(image, 2)],
      width,
      height,
      op,
      se,
    );
  }
  const data = new Uint8ClampedArray(image.data.length);
  const count = binary ? 1 : 3;
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    if (binary) {
      const value = planes[0]?.[i] ?? 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
    } else {
      for (let channel = 0; channel < count; channel += 1) {
        data[offset + channel] = planes[channel]?.[i] ?? 0;
      }
    }
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width, height, data };
}
