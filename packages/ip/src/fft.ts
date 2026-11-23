import type { ComplexImage, Plane } from "./types";

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function fft1d(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] ?? 0;
      const ti = im[i] ?? 0;
      re[i] = re[j] ?? 0;
      im[i] = im[j] ?? 0;
      re[j] = tr;
      im[j] = ti;
    }
  }
  for (let length = 2; length <= n; length *= 2) {
    const angle = ((inverse ? 1 : -1) * 2 * Math.PI) / length;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < length / 2; k += 1) {
        const even = start + k;
        const odd = even + length / 2;
        const or = re[odd] ?? 0;
        const oi = im[odd] ?? 0;
        const tr = or * cr - oi * ci;
        const ti = or * ci + oi * cr;
        re[odd] = (re[even] ?? 0) - tr;
        im[odd] = (im[even] ?? 0) - ti;
        re[even] = (re[even] ?? 0) + tr;
        im[even] = (im[even] ?? 0) + ti;
        const nextR = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nextR;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] = (re[i] ?? 0) / n;
      im[i] = (im[i] ?? 0) / n;
    }
  }
}

export function fft2(plane: Plane): ComplexImage {
  const width = nextPowerOfTwo(Math.max(1, plane.width));
  const height = nextPowerOfTwo(Math.max(1, plane.height));
  const re = new Float64Array(width * height);
  const im = new Float64Array(width * height);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      re[y * width + x] = plane.data[y * plane.width + x] ?? 0;
    }
  }
  const rowRe = new Float64Array(width);
  const rowIm = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    rowRe.set(re.subarray(y * width, (y + 1) * width));
    rowIm.set(im.subarray(y * width, (y + 1) * width));
    fft1d(rowRe, rowIm, false);
    re.set(rowRe, y * width);
    im.set(rowIm, y * width);
  }
  const columnRe = new Float64Array(height);
  const columnIm = new Float64Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      columnRe[y] = re[y * width + x] ?? 0;
      columnIm[y] = im[y * width + x] ?? 0;
    }
    fft1d(columnRe, columnIm, false);
    for (let y = 0; y < height; y += 1) {
      re[y * width + x] = columnRe[y] ?? 0;
      im[y * width + x] = columnIm[y] ?? 0;
    }
  }
  return { width, height, re, im };
}

export function ifft2(spectrum: ComplexImage): Plane {
  const { width, height } = spectrum;
  if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
    throw new RangeError("spectrum dimensions must be powers of two");
  }
  const re = new Float64Array(spectrum.re);
  const im = new Float64Array(spectrum.im);
  const rowRe = new Float64Array(width);
  const rowIm = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    rowRe.set(re.subarray(y * width, (y + 1) * width));
    rowIm.set(im.subarray(y * width, (y + 1) * width));
    fft1d(rowRe, rowIm, true);
    re.set(rowRe, y * width);
    im.set(rowIm, y * width);
  }
  const columnRe = new Float64Array(height);
  const columnIm = new Float64Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      columnRe[y] = re[y * width + x] ?? 0;
      columnIm[y] = im[y * width + x] ?? 0;
    }
    fft1d(columnRe, columnIm, true);
    for (let y = 0; y < height; y += 1) {
      re[y * width + x] = columnRe[y] ?? 0;
      im[y * width + x] = columnIm[y] ?? 0;
    }
  }
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.min(1, Math.max(0, re[i] ?? 0));
  }
  return { width, height, data };
}

export function fftShift(spectrum: ComplexImage): ComplexImage {
  const { width, height } = spectrum;
  const re = new Float64Array(width * height);
  const im = new Float64Array(width * height);
  const shiftX = Math.floor(width / 2);
  const shiftY = Math.floor(height / 2);
  for (let y = 0; y < height; y += 1) {
    const sourceY = (y + shiftY) % height;
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x + shiftX) % width;
      re[y * width + x] = spectrum.re[sourceY * width + sourceX] ?? 0;
      im[y * width + x] = spectrum.im[sourceY * width + sourceX] ?? 0;
    }
  }
  return { width, height, re, im };
}

export function fftMagnitude(spectrum: ComplexImage): Plane {
  const data = new Float32Array(spectrum.width * spectrum.height);
  let max = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = Math.log1p(Math.hypot(spectrum.re[i] ?? 0, spectrum.im[i] ?? 0));
    data[i] = value;
    max = Math.max(max, value);
  }
  if (max > 0) for (let i = 0; i < data.length; i += 1) data[i] = (data[i] ?? 0) / max;
  return { width: spectrum.width, height: spectrum.height, data };
}

export function fftPhase(spectrum: ComplexImage): Plane {
  const data = new Float32Array(spectrum.width * spectrum.height);
  for (let i = 0; i < data.length; i += 1) {
    const angle = Math.atan2(spectrum.im[i] ?? 0, spectrum.re[i] ?? 0);
    data[i] = (angle + Math.PI) / (2 * Math.PI);
  }
  return { width: spectrum.width, height: spectrum.height, data };
}
