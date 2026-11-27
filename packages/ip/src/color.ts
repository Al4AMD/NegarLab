import type { RgbaImage } from "./types";

export type ColorSpace = "rgb" | "hsv" | "hsl" | "ycbcr" | "cmyk" | "lab" | "gray";
export type ChromaMode = "4:4:4" | "4:2:2" | "4:2:0";
export type ColorBlindness = "protanopia" | "deuteranopia" | "tritanopia";
export type WhiteBalanceMethod = "gray-world" | "white-patch";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

const D65 = { x: 0.95047, y: 1, z: 1.08883 };

const COLOR_BLIND_MATRICES: Record<ColorBlindness, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function byte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function linearize(value: number): number {
  const c = clamp01(value);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function delinearize(value: number): number {
  const c = Math.max(0, value);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function rgbToHsv({ r, g, b }: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : delta / max, max];
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hue = ((h % 1) + 1) % 1;
  const sector = hue * 6;
  const i = Math.floor(sector);
  const f = sector - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return { r: v, g: t, b: p };
    case 1:
      return { r: q, g: v, b: p };
    case 2:
      return { r: p, g: v, b: t };
    case 3:
      return { r: p, g: q, b: v };
    case 4:
      return { r: t, g: p, b: v };
    default:
      return { r: v, g: p, b: q };
  }
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 1) + 1) % 1;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = l - c / 2;
  let rgb: Rgb;
  if (hue < 1 / 6) rgb = { r: c, g: x, b: 0 };
  else if (hue < 2 / 6) rgb = { r: x, g: c, b: 0 };
  else if (hue < 3 / 6) rgb = { r: 0, g: c, b: x };
  else if (hue < 4 / 6) rgb = { r: 0, g: x, b: c };
  else if (hue < 5 / 6) rgb = { r: x, g: 0, b: c };
  else rgb = { r: c, g: 0, b: x };
  return { r: rgb.r + m, g: rgb.g + m, b: rgb.b + m };
}

function rgbToYcbcr({ r, g, b }: Rgb): [number, number, number] {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  ];
}

function ycbcrToRgb(y: number, cb: number, cr: number): Rgb {
  return {
    r: y + 1.402 * (cr - 128),
    g: y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128),
    b: y + 1.772 * (cb - 128),
  };
}

function rgbToCmyk({ r, g, b }: Rgb): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}

function cmykToRgb(c: number, m: number, y: number, k: number): Rgb {
  return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k) };
}

function rgbToXyz({ r, g, b }: Rgb): [number, number, number] {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);
  return [
    0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb,
    0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb,
    0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb,
  ];
}

function labF(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function labInverse(value: number): number {
  const cube = value ** 3;
  return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787;
}

function rgbToLab(rgb: Rgb): Lab {
  const [x, y, z] = rgbToXyz(rgb);
  const fx = labF(x / D65.x);
  const fy = labF(y / D65.y);
  const fz = labF(z / D65.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labToRgb(lab: Lab): Rgb {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const x = D65.x * labInverse(fx);
  const y = D65.y * labInverse(fy);
  const z = D65.z * labInverse(fz);
  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return { r: delinearize(lr), g: delinearize(lg), b: delinearize(lb) };
}

function channelsFor(space: ColorSpace, rgb: Rgb): number[] {
  switch (space) {
    case "rgb":
      return [rgb.r, rgb.g, rgb.b];
    case "hsv":
      return rgbToHsv(rgb);
    case "hsl":
      return rgbToHsl(rgb);
    case "ycbcr":
      return rgbToYcbcr(rgb).map((value, index) => (index === 0 ? value / 255 : value / 255));
    case "cmyk":
      return rgbToCmyk(rgb);
    case "lab": {
      const lab = rgbToLab(rgb);
      return [lab.l / 100, (lab.a + 128) / 255, (lab.b + 128) / 255];
    }
    case "gray":
      return [0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b];
  }
}

function fromChannels(space: ColorSpace, channels: number[]): Rgb {
  switch (space) {
    case "rgb":
      return { r: channels[0] ?? 0, g: channels[1] ?? 0, b: channels[2] ?? 0 };
    case "hsv":
      return hsvToRgb(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0);
    case "hsl":
      return hslToRgb(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0);
    case "ycbcr":
      return ycbcrToRgb(
        (channels[0] ?? 0) * 255,
        (channels[1] ?? 0) * 255,
        (channels[2] ?? 0) * 255,
      );
    case "cmyk":
      return cmykToRgb(
        channels[0] ?? 0,
        channels[1] ?? 0,
        channels[2] ?? 0,
        channels[3] ?? 0,
      );
    case "lab":
      return labToRgb({
        l: (channels[0] ?? 0) * 100,
        a: (channels[1] ?? 0) * 255 - 128,
        b: (channels[2] ?? 0) * 255 - 128,
      });
    case "gray": {
      const value = channels[0] ?? 0;
      return { r: value, g: value, b: value };
    }
  }
}

function channelCount(space: ColorSpace): number {
  if (space === "cmyk") return 4;
  if (space === "gray") return 1;
  return 3;
}

function channelAt(space: ColorSpace, channels: number[], channel: number): number {
  if (space === "ycbcr") {
    if (channel === 0) return channels[0] ?? 0;
    return (channels[channel] ?? 0) * 255;
  }
  return channels[channel] ?? 0;
}

export function colorSpaceView(image: RgbaImage, space: ColorSpace, channel: number): RgbaImage {
  const count = channelCount(space);
  if (!Number.isInteger(channel) || channel < -1 || channel >= count) {
    throw new RangeError("channel out of range");
  }
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const offset = i * 4;
    const rgb: Rgb = {
      r: (image.data[offset] ?? 0) / 255,
      g: (image.data[offset + 1] ?? 0) / 255,
      b: (image.data[offset + 2] ?? 0) / 255,
    };
    const channels = channelsFor(space, rgb);
    let out: Rgb;
    if (channel === -1) {
      out = space === "gray" ? { r: channels[0] ?? 0, g: channels[0] ?? 0, b: channels[0] ?? 0 } : fromChannels(space, channels);
    } else {
      const value = channelAt(space, channels, channel);
      out = { r: value, g: value, b: value };
    }
    data[offset] = byte(out.r);
    data[offset + 1] = byte(out.g);
    data[offset + 2] = byte(out.b);
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data };
}

export function subsampleChroma(image: RgbaImage, mode: ChromaMode): RgbaImage {
  const { width, height } = image;
  const y = new Float32Array(width * height);
  const cb = new Float32Array(width * height);
  const cr = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const [luma, blue, red] = rgbToYcbcr({
      r: (image.data[offset] ?? 0) / 255,
      g: (image.data[offset + 1] ?? 0) / 255,
      b: (image.data[offset + 2] ?? 0) / 255,
    });
    y[i] = luma;
    cb[i] = blue;
    cr[i] = red;
  }
  if (mode !== "4:4:4") {
    const blockY = mode === "4:2:0" ? 2 : 1;
    for (let by = 0; by < height; by += blockY) {
      for (let bx = 0; bx < width; bx += 2) {
        let sumCb = 0;
        let sumCr = 0;
        let count = 0;
        for (let dy = 0; dy < blockY && by + dy < height; dy += 1) {
          for (let dx = 0; dx < 2 && bx + dx < width; dx += 1) {
            const index = (by + dy) * width + bx + dx;
            sumCb += cb[index] ?? 0;
            sumCr += cr[index] ?? 0;
            count += 1;
          }
        }
        const avgCb = sumCb / count;
        const avgCr = sumCr / count;
        for (let dy = 0; dy < blockY && by + dy < height; dy += 1) {
          for (let dx = 0; dx < 2 && bx + dx < width; dx += 1) {
            const index = (by + dy) * width + bx + dx;
            cb[index] = avgCb;
            cr[index] = avgCr;
          }
        }
      }
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const out = ycbcrToRgb(y[i] ?? 0, cb[i] ?? 0, cr[i] ?? 0);
    data[offset] = byte(out.r);
    data[offset + 1] = byte(out.g);
    data[offset + 2] = byte(out.b);
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width, height, data };
}

export function simulateColorBlindness(
  image: RgbaImage,
  kind: ColorBlindness,
  severity: number,
): RgbaImage {
  const amount = clamp01(severity);
  const matrix = COLOR_BLIND_MATRICES[kind];
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const offset = i * 4;
    const r = linearize((image.data[offset] ?? 0) / 255);
    const g = linearize((image.data[offset + 1] ?? 0) / 255);
    const b = linearize((image.data[offset + 2] ?? 0) / 255);
    const mixed = [
      (1 - amount) * r + amount * ((matrix[0] ?? 1) * r + (matrix[1] ?? 0) * g + (matrix[2] ?? 0) * b),
      (1 - amount) * g + amount * ((matrix[3] ?? 0) * r + (matrix[4] ?? 1) * g + (matrix[5] ?? 0) * b),
      (1 - amount) * b + amount * ((matrix[6] ?? 0) * r + (matrix[7] ?? 0) * g + (matrix[8] ?? 1) * b),
    ];
    data[offset] = byte(delinearize(mixed[0] ?? 0));
    data[offset + 1] = byte(delinearize(mixed[1] ?? 0));
    data[offset + 2] = byte(delinearize(mixed[2] ?? 0));
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data };
}

export function balanceWhite(image: RgbaImage, method: WhiteBalanceMethod): RgbaImage {
  const n = image.width * image.height;
  if (n === 0) return { width: image.width, height: image.height, data: new Uint8ClampedArray(0) };
  const sums = [0, 0, 0];
  const histograms: [Uint32Array, Uint32Array, Uint32Array] = [
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
  ];
  for (let i = 0; i < n; i += 1) {
    const offset = i * 4;
    for (let c = 0; c < 3; c += 1) {
      const value = image.data[offset + c] ?? 0;
      sums[c] = (sums[c] ?? 0) + value;
      const histogram = histograms[c] ?? histograms[0];
      histogram[value] = (histogram[value] ?? 0) + 1;
    }
  }
  const gains = [1, 1, 1];
  if (method === "gray-world") {
    const average = ((sums[0] ?? 0) + (sums[1] ?? 0) + (sums[2] ?? 0)) / (3 * n);
    for (let c = 0; c < 3; c += 1) {
      const mean = (sums[c] ?? 0) / n;
      gains[c] = mean > 0 ? average / mean : 1;
    }
  } else {
    const targetRank = Math.max(1, Math.ceil(0.99 * n));
    const whites = [0, 0, 0];
    for (let c = 0; c < 3; c += 1) {
      const histogram = histograms[c] ?? histograms[0];
      let cumulative = 0;
      for (let value = 0; value < 256; value += 1) {
        cumulative += histogram[value] ?? 0;
        if (cumulative >= targetRank) {
          whites[c] = value;
          break;
        }
      }
    }
    const target = Math.max(whites[0] ?? 0, whites[1] ?? 0, whites[2] ?? 0);
    for (let c = 0; c < 3; c += 1) {
      gains[c] = (whites[c] ?? 0) > 0 ? target / (whites[c] ?? 1) : 1;
    }
  }
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < n; i += 1) {
    const offset = i * 4;
    for (let c = 0; c < 3; c += 1) {
      data[offset + c] = byte(((image.data[offset + c] ?? 0) / 255) * (gains[c] ?? 1));
    }
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data };
}
