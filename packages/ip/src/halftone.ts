import type { RgbaImage } from "./types";

export type HalftoneMethod = "floyd-steinberg" | "bayer";
export type PaletteMethod = "median-cut" | "kmeans";

export interface PaletteResult {
  readonly image: RgbaImage;
  readonly palette: Array<[number, number, number]>;
}

const MAX_SAMPLES = 20_000;

function luma(image: RgbaImage): Float32Array {
  const values = new Float32Array(image.width * image.height);
  for (let i = 0; i < values.length; i += 1) {
    const offset = i * 4;
    values[i] =
      0.299 * (image.data[offset] ?? 0) +
      0.587 * (image.data[offset + 1] ?? 0) +
      0.114 * (image.data[offset + 2] ?? 0);
  }
  return values;
}

function bayerMatrix(size: number): number[][] {
  if (size === 1) return [[0]];
  if (size !== 2 && size !== 4 && size !== 8) {
    throw new RangeError("matrix size must be 2, 4, or 8");
  }
  const half = size / 2;
  const previous = bayerMatrix(half);
  const matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < half; x += 1) {
      const value = (previous[y]?.[x] ?? 0) * 4;
      const row = matrix[y] as number[];
      const lower = matrix[y + half] as number[];
      row[x] = value;
      row[x + half] = value + 2;
      lower[x] = value + 3;
      lower[x + half] = value + 1;
    }
  }
  return matrix;
}

export function halftone(image: RgbaImage, method: HalftoneMethod, matrixSize = 4): RgbaImage {
  const { width, height } = image;
  const values = luma(image);
  const data = new Uint8ClampedArray(image.data.length);
  if (method === "floyd-steinberg") {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const old = values[index] ?? 0;
        const next = old < 128 ? 0 : 255;
        const error = old - next;
        values[index] = next;
        if (x + 1 < width) values[index + 1] = (values[index + 1] ?? 0) + (error * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) values[index + width - 1] = (values[index + width - 1] ?? 0) + (error * 3) / 16;
          values[index + width] = (values[index + width] ?? 0) + (error * 5) / 16;
          if (x + 1 < width) {
            values[index + width + 1] = (values[index + width + 1] ?? 0) + error / 16;
          }
        }
      }
    }
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] ?? 0;
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = image.data[i * 4 + 3] ?? 255;
    }
    return { width, height, data };
  }
  const matrix = bayerMatrix(matrixSize);
  const scale = matrixSize * matrixSize;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const threshold = (((matrix[y % matrixSize]?.[x % matrixSize] ?? 0) + 0.5) / scale) * 255;
      const value = (values[index] ?? 0) > threshold ? 255 : 0;
      data[index * 4] = value;
      data[index * 4 + 1] = value;
      data[index * 4 + 2] = value;
      data[index * 4 + 3] = image.data[index * 4 + 3] ?? 255;
    }
  }
  return { width, height, data };
}

function samplePixels(image: RgbaImage): Array<[number, number, number]> {
  const total = image.width * image.height;
  const stride = Math.max(1, Math.floor(Math.sqrt(total / MAX_SAMPLES)));
  const samples: Array<[number, number, number]> = [];
  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const offset = (y * image.width + x) * 4;
      samples.push([image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0]);
    }
  }
  return samples;
}

function medianCut(
  samples: Array<[number, number, number]>,
  colors: number,
): Array<[number, number, number]> {
  let boxes: number[][] = [samples.map((_, index) => index)];
  while (boxes.length < colors) {
    let target = -1;
    let bestRange = 0;
    let bestChannel = 0;
    for (let boxIndex = 0; boxIndex < boxes.length; boxIndex += 1) {
      const box = boxes[boxIndex] as number[];
      if (box.length < 2) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        let min = 255;
        let max = 0;
        for (const index of box) {
          const value = samples[index]?.[channel] ?? 0;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        const range = max - min;
        if (range > bestRange) {
          bestRange = range;
          target = boxIndex;
          bestChannel = channel;
        }
      }
    }
    if (target < 0 || bestRange === 0) break;
    const box = boxes[target] as number[];
    box.sort(
      (a, b) =>
        (samples[a]?.[bestChannel] ?? 0) - (samples[b]?.[bestChannel] ?? 0) || a - b,
    );
    const middle = Math.floor(box.length / 2);
    const left = box.slice(0, middle);
    const right = box.slice(middle);
    boxes = [...boxes.slice(0, target), left, right, ...boxes.slice(target + 1)];
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const index of box) {
      const sample = samples[index] ?? [0, 0, 0];
      r += sample[0];
      g += sample[1];
      b += sample[2];
    }
    const count = Math.max(1, box.length);
    return [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as [
      number,
      number,
      number,
    ];
  });
}

function nearest(palette: Array<[number, number, number]>, r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < palette.length; index += 1) {
    const color = palette[index] ?? [0, 0, 0];
    const distance = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

function kmeans(
  samples: Array<[number, number, number]>,
  colors: number,
): Array<[number, number, number]> {
  let centroids = medianCut(samples, colors).map(
    (color) => [color[0], color[1], color[2]] as [number, number, number],
  );
  if (centroids.length === 0) return [];
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sums = centroids.map(() => [0, 0, 0]);
    const counts = centroids.map(() => 0);
    for (const sample of samples) {
      const index = nearest(centroids, sample[0], sample[1], sample[2]);
      const sum = sums[index] as number[];
      sum[0] = (sum[0] ?? 0) + sample[0];
      sum[1] = (sum[1] ?? 0) + sample[1];
      sum[2] = (sum[2] ?? 0) + sample[2];
      counts[index] = (counts[index] ?? 0) + 1;
    }
    centroids = centroids.map((centroid, index) => {
      const count = counts[index] ?? 0;
      if (count === 0) return centroid;
      const sum = sums[index] ?? [0, 0, 0];
      return [(sum[0] ?? 0) / count, (sum[1] ?? 0) / count, (sum[2] ?? 0) / count];
    });
  }
  return centroids.map((color) => [
    Math.round(color[0]),
    Math.round(color[1]),
    Math.round(color[2]),
  ]);
}

export function reducePalette(
  image: RgbaImage,
  colors: number,
  method: PaletteMethod,
  dither: boolean,
  seed = 1,
): PaletteResult {
  if (!Number.isInteger(colors) || colors < 1 || colors > 256) {
    throw new RangeError("colors must be an integer in 1..256");
  }
  void seed;
  const samples = samplePixels(image);
  const palette = method === "median-cut" ? medianCut(samples, colors) : kmeans(samples, colors);
  const { width, height } = image;
  const data = new Uint8ClampedArray(image.data.length);
  if (dither) {
    const work = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i += 1) {
      work[i * 3] = image.data[i * 4] ?? 0;
      work[i * 3 + 1] = image.data[i * 4 + 1] ?? 0;
      work[i * 3 + 2] = image.data[i * 4 + 2] ?? 0;
    }
    const push = (index: number, channel: number, value: number): void => {
      if (index < 0 || index >= width * height) return;
      work[index * 3 + channel] = (work[index * 3 + channel] ?? 0) + value;
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const r = work[index * 3] ?? 0;
        const g = work[index * 3 + 1] ?? 0;
        const b = work[index * 3 + 2] ?? 0;
        const choice = palette[nearest(palette, r, g, b)] ?? [0, 0, 0];
        for (let channel = 0; channel < 3; channel += 1) {
          const error = [r, g, b][channel] ?? 0;
          const chosen = choice[channel] ?? 0;
          const delta = error - chosen;
          if (x + 1 < width) push(index + 1, channel, (delta * 7) / 16);
          if (y + 1 < height) {
            if (x > 0) push(index + width - 1, channel, (delta * 3) / 16);
            push(index + width, channel, (delta * 5) / 16);
            if (x + 1 < width) push(index + width + 1, channel, delta / 16);
          }
        }
        data[index * 4] = choice[0];
        data[index * 4 + 1] = choice[1];
        data[index * 4 + 2] = choice[2];
        data[index * 4 + 3] = image.data[index * 4 + 3] ?? 255;
      }
    }
    return { image: { width, height, data }, palette };
  }
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const choice =
      palette[nearest(palette, image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0)] ??
      [0, 0, 0];
    data[offset] = choice[0];
    data[offset + 1] = choice[1];
    data[offset + 2] = choice[2];
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { image: { width, height, data }, palette };
}
