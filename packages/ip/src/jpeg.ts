import { dct8, idct8, jpegQuantTable, zigzag } from "./dct";
import { huffmanLengths } from "./huffman";
import type { RgbaImage } from "./types";

export type JpegChannel = "y" | "cb" | "cr";

export interface JpegResult {
  image: RgbaImage;
  quality: number;
  lumaTable: Int32Array;
  chromaTable: Int32Array;
  encodedBytes: number;
  bpp: number;
  ratio: number;
}

export interface JpegRleSymbol {
  run: number;
  size: number;
  value: number;
}

export interface JpegBlockStages {
  channel: JpegChannel;
  blockX: number;
  blockY: number;
  source: Float64Array;
  levelShifted: Float64Array;
  dct: Float64Array;
  quantized: Int32Array;
  zigzag: Int32Array;
  reconstructed: Float64Array;
  dcDiff: number;
  rle: JpegRleSymbol[];
}

interface Planes {
  y: Float64Array;
  cb: Float64Array;
  cr: Float64Array;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.floor(value + 0.5)));
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

function toYCbCr(image: RgbaImage): Planes {
  const length = image.width * image.height;
  const y = new Float64Array(length);
  const cb = new Float64Array(length);
  const cr = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    const base = i * 4;
    const r = image.data[base] ?? 0;
    const g = image.data[base + 1] ?? 0;
    const b = image.data[base + 2] ?? 0;
    y[i] = clampByte(0.299 * r + 0.587 * g + 0.114 * b);
    cb[i] = clampByte(-0.168736 * r - 0.331264 * g + 0.5 * b + 128);
    cr[i] = clampByte(0.5 * r - 0.418688 * g - 0.081312 * b + 128);
  }
  return { y, cb, cr };
}

function fromYCbCr(
  planes: Planes,
  width: number,
  height: number,
  alpha: Uint8ClampedArray,
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const luma = planes.y[i] ?? 0;
    const blue = (planes.cb[i] ?? 128) - 128;
    const red = (planes.cr[i] ?? 128) - 128;
    data[i * 4] = clampByte(luma + 1.402 * red);
    data[i * 4 + 1] = clampByte(luma - 0.344136 * blue - 0.714136 * red);
    data[i * 4 + 2] = clampByte(luma + 1.772 * blue);
    data[i * 4 + 3] = alpha[i * 4 + 3] ?? 255;
  }
  return { width, height, data };
}

function category(value: number): number {
  const magnitude = Math.abs(value);
  return magnitude === 0 ? 0 : Math.floor(Math.log2(magnitude)) + 1;
}

function blockSource(
  plane: Float64Array,
  width: number,
  height: number,
  blockX: number,
  blockY: number,
): Float64Array {
  const block = new Float64Array(64);
  for (let y = 0; y < 8; y += 1) {
    const sourceY = Math.min(height - 1, blockY * 8 + y);
    for (let x = 0; x < 8; x += 1) {
      const sourceX = Math.min(width - 1, blockX * 8 + x);
      block[y * 8 + x] = plane[sourceY * width + sourceX] ?? 0;
    }
  }
  return block;
}

function quantizeBlock(
  plane: Float64Array,
  width: number,
  height: number,
  blockX: number,
  blockY: number,
  table: Int32Array,
): Int32Array {
  const source = blockSource(plane, width, height, blockX, blockY);
  const shifted = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) shifted[i] = (source[i] ?? 0) - 128;
  const coeffs = dct8(shifted);
  const quantized = new Int32Array(64);
  for (let i = 0; i < 64; i += 1) {
    quantized[i] = roundHalfUp((coeffs[i] ?? 0) / (table[i] ?? 1));
  }
  return quantized;
}

function collectSymbols(
  quantized: Int32Array,
  previousDc: number,
  dcFrequencies: Uint32Array,
  acFrequencies: Uint32Array,
): number {
  const dcDiff = (quantized[0] ?? 0) - previousDc;
  const dcSymbol = category(dcDiff);
  dcFrequencies[dcSymbol] = (dcFrequencies[dcSymbol] ?? 0) + 1;
  let run = 0;
  const scan = zigzag(quantized);
  for (let i = 1; i < 64; i += 1) {
    const value = scan[i] ?? 0;
    if (value === 0) {
      run += 1;
      continue;
    }
    while (run > 15) {
      acFrequencies[0xf0] = (acFrequencies[0xf0] ?? 0) + 1;
      run -= 16;
    }
    const symbol = (run << 4) | category(value);
    acFrequencies[symbol] = (acFrequencies[symbol] ?? 0) + 1;
    run = 0;
  }
  if (run > 0) acFrequencies[0] = (acFrequencies[0] ?? 0) + 1;
  return quantized[0] ?? 0;
}

function processPlane(
  plane: Float64Array,
  width: number,
  height: number,
  table: Int32Array,
  dcFrequencies: Uint32Array,
  acFrequencies: Uint32Array,
): Float64Array {
  const output = new Float64Array(width * height);
  const blocksX = Math.ceil(width / 8);
  const blocksY = Math.ceil(height / 8);
  let previousDc = 0;
  for (let blockY = 0; blockY < blocksY; blockY += 1) {
    for (let blockX = 0; blockX < blocksX; blockX += 1) {
      const source = blockSource(plane, width, height, blockX, blockY);
      const shifted = new Float64Array(64);
      for (let i = 0; i < 64; i += 1) shifted[i] = (source[i] ?? 0) - 128;
      const coeffs = dct8(shifted);
      const quantized = new Int32Array(64);
      for (let i = 0; i < 64; i += 1) {
        quantized[i] = roundHalfUp((coeffs[i] ?? 0) / (table[i] ?? 1));
      }
      previousDc = collectSymbols(quantized, previousDc, dcFrequencies, acFrequencies);
      const dequantized = new Float64Array(64);
      for (let i = 0; i < 64; i += 1) {
        dequantized[i] = (quantized[i] ?? 0) * (table[i] ?? 1);
      }
      const restored = idct8(dequantized);
      for (let y = 0; y < 8; y += 1) {
        const targetY = blockY * 8 + y;
        if (targetY >= height) break;
        for (let x = 0; x < 8; x += 1) {
          const targetX = blockX * 8 + x;
          if (targetX >= width) break;
          output[targetY * width + targetX] = Math.min(
            255,
            Math.max(0, (restored[y * 8 + x] ?? 0) + 128),
          );
        }
      }
    }
  }
  return output;
}

export function jpegReconstruct(image: RgbaImage, quality: number): JpegResult {
  const clampedQuality = Math.min(100, Math.max(1, Math.round(quality)));
  const { luma, chroma } = jpegQuantTable(clampedQuality);
  const width = image.width;
  const height = image.height;
  if (width === 0 || height === 0) {
    return {
      image: { width, height, data: new Uint8ClampedArray(image.data) },
      quality: clampedQuality,
      lumaTable: luma,
      chromaTable: chroma,
      encodedBytes: 0,
      bpp: 0,
      ratio: 1,
    };
  }
  const planes = toYCbCr(image);
  const dcFrequencies = new Uint32Array(256);
  const acFrequencies = new Uint32Array(256);
  const reconstructed: Planes = {
    y: processPlane(planes.y, width, height, luma, dcFrequencies, acFrequencies),
    cb: processPlane(planes.cb, width, height, chroma, dcFrequencies, acFrequencies),
    cr: processPlane(planes.cr, width, height, chroma, dcFrequencies, acFrequencies),
  };
  const dcLengths = huffmanLengths(dcFrequencies);
  const acLengths = huffmanLengths(acFrequencies);
  let bits = 0;
  for (let symbol = 0; symbol < 256; symbol += 1) {
    bits += (dcFrequencies[symbol] ?? 0) * (dcLengths[symbol] ?? 0);
    bits += (acFrequencies[symbol] ?? 0) * (acLengths[symbol] ?? 0);
  }
  const encodedBytes = Math.ceil(bits / 8);
  const rawBytes = width * height * 3;
  return {
    image: fromYCbCr(reconstructed, width, height, image.data),
    quality: clampedQuality,
    lumaTable: luma,
    chromaTable: chroma,
    encodedBytes,
    bpp: (encodedBytes * 8) / (width * height),
    ratio: encodedBytes === 0 ? 1 : rawBytes / encodedBytes,
  };
}

export function jpegBlock(
  image: RgbaImage,
  blockX: number,
  blockY: number,
  quality: number,
  channel: JpegChannel,
): JpegBlockStages {
  const width = image.width;
  const height = image.height;
  if (width === 0 || height === 0) throw new RangeError("empty image");
  const blocksX = Math.ceil(width / 8);
  const blocksY = Math.ceil(height / 8);
  const bx = Math.min(blocksX - 1, Math.max(0, Math.floor(blockX)));
  const by = Math.min(blocksY - 1, Math.max(0, Math.floor(blockY)));
  const clampedQuality = Math.min(100, Math.max(1, Math.round(quality)));
  const table = jpegQuantTable(clampedQuality);
  const planes = toYCbCr(image);
  const plane = planes[channel];
  const quantization = channel === "y" ? table.luma : table.chroma;

  const source = blockSource(plane, width, height, bx, by);
  const levelShifted = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) levelShifted[i] = (source[i] ?? 0) - 128;
  const coefficients = dct8(levelShifted);
  const quantized = new Int32Array(64);
  for (let i = 0; i < 64; i += 1) {
    quantized[i] = roundHalfUp((coefficients[i] ?? 0) / (quantization[i] ?? 1));
  }
  const dequantized = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) dequantized[i] = (quantized[i] ?? 0) * (quantization[i] ?? 1);
  const inverse = idct8(dequantized);
  const reconstructed = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) {
    reconstructed[i] = Math.min(255, Math.max(0, (inverse[i] ?? 0) + 128));
  }

  let previousDc = 0;
  const raster = by * blocksX + bx;
  if (raster > 0) {
    const previousX = (raster - 1) % blocksX;
    const previousY = Math.floor((raster - 1) / blocksX);
    previousDc = quantizeBlock(plane, width, height, previousX, previousY, quantization)[0] ?? 0;
  }
  const dcDiff = (quantized[0] ?? 0) - previousDc;
  const scan = zigzag(quantized);
  const rle: JpegRleSymbol[] = [];
  let run = 0;
  for (let i = 1; i < 64; i += 1) {
    const value = scan[i] ?? 0;
    if (value === 0) {
      run += 1;
      continue;
    }
    while (run > 15) {
      rle.push({ run: 15, size: 0, value: 0 });
      run -= 16;
    }
    rle.push({ run, size: category(value), value });
    run = 0;
  }
  if (run > 0) rle.push({ run: 0, size: 0, value: 0 });

  return {
    channel,
    blockX: bx,
    blockY: by,
    source,
    levelShifted,
    dct: coefficients,
    quantized,
    zigzag: Int32Array.from(scan),
    reconstructed,
    dcDiff,
    rle,
  };
}
