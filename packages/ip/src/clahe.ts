import { histogramCdf } from "./histogram";
import type { RgbaImage } from "./types";

export interface ClaheOptions {
  readonly tiles?: number;
  readonly clipLimit?: number;
}

function tileLut(
  data: Uint8ClampedArray,
  imageWidth: number,
  channel: 0 | 1 | 2,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  clipLimit: number,
): Uint8Array {
  const counts = new Float64Array(256);
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const value = data[(y * imageWidth + x) * 4 + channel] ?? 0;
      counts[value] = (counts[value] ?? 0) + 1;
      total += 1;
    }
  }
  const lookup = new Uint8Array(256);
  if (total === 0) return lookup;

  const clip = Math.max(1, Math.floor((clipLimit * total) / 256));
  let excess = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    const count = counts[bin] ?? 0;
    if (count > clip) {
      excess += count - clip;
      counts[bin] = clip;
    }
  }
  for (let bin = 0; bin < 256; bin += 1) counts[bin] = (counts[bin] ?? 0) + excess / 256;

  const integral = new Uint32Array(256);
  let cumulative = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    cumulative += Math.round(counts[bin] ?? 0);
    integral[bin] = cumulative;
  }
  const cdf = histogramCdf(integral);
  let cdfMin = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    if ((integral[bin] ?? 0) > 0) {
      cdfMin = cdf[bin] ?? 0;
      break;
    }
  }
  const scale = 1 - cdfMin;
  for (let bin = 0; bin < 256; bin += 1) {
    lookup[bin] = scale <= 0 ? bin : Math.round((((cdf[bin] ?? 0) - cdfMin) / scale) * 255);
  }
  return lookup;
}

function tileLuts(
  image: RgbaImage,
  channel: 0 | 1 | 2,
  tiles: number,
  clipLimit: number,
): Uint8Array[][] {
  const luts: Uint8Array[][] = [];
  for (let ty = 0; ty < tiles; ty += 1) {
    const row: Uint8Array[] = [];
    const y0 = Math.floor((ty * image.height) / tiles);
    const y1 = Math.floor(((ty + 1) * image.height) / tiles);
    for (let tx = 0; tx < tiles; tx += 1) {
      const x0 = Math.floor((tx * image.width) / tiles);
      const x1 = Math.floor(((tx + 1) * image.width) / tiles);
      row.push(tileLut(image.data, image.width, channel, x0, x1, y0, y1, clipLimit));
    }
    luts.push(row);
  }
  return luts;
}

export function clahe(image: RgbaImage, options: ClaheOptions = {}): RgbaImage {
  const tiles = options.tiles ?? 8;
  const clipLimit = options.clipLimit ?? 2;
  if (!Number.isInteger(tiles) || tiles < 1) {
    throw new RangeError("tiles must be a positive integer");
  }
  if (!Number.isFinite(clipLimit) || clipLimit <= 0) {
    throw new RangeError("clipLimit must be positive");
  }
  if (image.width === 0 || image.height === 0) {
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  }

  const data = new Uint8ClampedArray(image.data.length);
  const tileCount = Math.min(tiles, image.width, image.height);
  const luts = [0, 1, 2].map((channel) =>
    tileLuts(image, channel as 0 | 1 | 2, tileCount, clipLimit),
  );

  for (let y = 0; y < image.height; y += 1) {
    const fyRaw = ((y + 0.5) * tileCount) / image.height - 0.5;
    const fy = Math.min(tileCount - 1, Math.max(0, fyRaw));
    const ty0 = Math.floor(fy);
    const ty1 = Math.min(tileCount - 1, ty0 + 1);
    const ay = fy - ty0;
    for (let x = 0; x < image.width; x += 1) {
      const fxRaw = ((x + 0.5) * tileCount) / image.width - 0.5;
      const fx = Math.min(tileCount - 1, Math.max(0, fxRaw));
      const tx0 = Math.floor(fx);
      const tx1 = Math.min(tileCount - 1, tx0 + 1);
      const ax = fx - tx0;
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const lookup = luts[channel] ?? [];
        const topLeft = lookup[ty0]?.[tx0] ?? new Uint8Array(256);
        const topRight = lookup[ty0]?.[tx1] ?? topLeft;
        const bottomLeft = lookup[ty1]?.[tx0] ?? topLeft;
        const bottomRight = lookup[ty1]?.[tx1] ?? bottomLeft;
        const value = image.data[offset + channel] ?? 0;
        const top = (topLeft[value] ?? 0) * (1 - ax) + (topRight[value] ?? 0) * ax;
        const bottom = (bottomLeft[value] ?? 0) * (1 - ax) + (bottomRight[value] ?? 0) * ax;
        data[offset + channel] = Math.round(top * (1 - ay) + bottom * ay);
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}
