import type {
  ChromaMode,
  ColorBlindness,
  ColorSpace,
  DeconvolutionOptions,
  FrequencyFilterOptions,
  GeometryOptions,
  HalftoneMethod,
  ImageStats,
  JpegBlockStages,
  JpegChannel,
  JpegResult,
  LosslessReport,
  MetricsResult,
  MorphologyOp,
  NoiseKind,
  PaletteMethod,
  PaletteResult,
  RgbaImage,
  StructuringShape,
  WhiteBalanceMethod,
} from "@negarlab/ip";
import {
  addNoise,
  applyFrequencyFilter,
  applyMorphology,
  balanceWhite,
  bilateralFilter,
  byteHistogram,
  cannyEdges,
  clahe,
  colorSpaceView,
  compareMetrics,
  contrastStretch,
  deconvolve,
  defocusBlur,
  equalize,
  errorHeatmap,
  fft2,
  fftMagnitude,
  fftPhase,
  fftShift,
  gammaCorrect,
  gaussianFilter,
  gaussianPyramid,
  halftone,
  jpegBlock as jpegBlockStages,
  jpegReconstruct,
  laplacianImage,
  laplacianPyramid,
  logImage,
  logTransform,
  losslessReport,
  lumaHistogram,
  meanFilter,
  medianFilter,
  motionBlur,
  multiscaleBlend,
  negative,
  otsuThreshold,
  planeStats,
  prewittMagnitude,
  psnr,
  pyramidContactSheet,
  quantizeBits,
  reducePalette,
  resizeNearest,
  rgbaToLuma,
  sharpenFilter,
  simulateColorBlindness,
  sobelMagnitude,
  ssim,
  structuringElement,
  subsampleChroma,
  threshold,
  transformImage,
  unsharpMask,
  wienerDenoise,
} from "@negarlab/ip";
import * as Comlink from "comlink";

export interface ImageAnalysis {
  stats: ImageStats;
  lumaHistogram: Uint32Array;
  channels: [Uint32Array, Uint32Array, Uint32Array];
}

export type OpRequest =
  | { kind: "negative" }
  | { kind: "log" }
  | { kind: "gamma"; gamma: number }
  | { kind: "equalize" }
  | { kind: "stretch"; low: number; high: number }
  | { kind: "otsu" }
  | { kind: "threshold"; cutoff: number }
  | { kind: "clahe"; tiles: number; clipLimit: number }
  | { kind: "quantize"; bits: number }
  | { kind: "resize"; factor: number };

export type SpatialRequest =
  | { kind: "mean"; size: number }
  | { kind: "gaussian"; size: number; sigma: number }
  | { kind: "median"; radius: number }
  | { kind: "bilateral"; radius: number; sigmaSpace: number; sigmaRange: number }
  | { kind: "sharpen" }
  | { kind: "unsharp"; sigma: number; amount: number }
  | { kind: "sobel" }
  | { kind: "prewitt" }
  | { kind: "laplacian" }
  | { kind: "log"; sigma: number }
  | { kind: "canny"; low: number; high: number; sigma: number };

export interface SpectrumAnalysis {
  width: number;
  height: number;
  magnitude: Float32Array;
  phase: Float32Array;
}

export interface MetricsComparison {
  metrics: MetricsResult;
  heatmap: RgbaImage;
  ssimMap: Float32Array;
  width: number;
  height: number;
}

export type ColorRequest =
  | { kind: "space"; space: ColorSpace; channel: number }
  | { kind: "subsample"; mode: ChromaMode }
  | { kind: "colorblind"; deficiency: ColorBlindness; severity: number }
  | { kind: "balance"; method: WhiteBalanceMethod };

export type MorphologyRequest = {
  kind: MorphologyOp;
  size: number;
  shape: StructuringShape;
  mask?: number[];
  binaryThreshold?: number;
};

export type GeometryRequest =
  | { kind: "transform"; options: GeometryOptions }
  | { kind: "pyramid"; levels: number; laplacian: boolean }
  | { kind: "blend"; levels: number; mix: number };

export type NoiseRequest = { kind: NoiseKind; amount: number; seed: number };

export type RestoreRequest =
  | { kind: "median"; radius: number }
  | { kind: "bilateral"; radius: number; sigmaSpace: number; sigmaRange: number }
  | { kind: "wiener-denoise"; strength: number }
  | {
      kind: "inverse" | "wiener";
      blur: "motion" | "defocus";
      length: number;
      angle: number;
      radius: number;
      strength: number;
    };

export type HalftoneRequest =
  | { kind: "halftone"; method: HalftoneMethod; matrixSize: number }
  | { kind: "palette"; colors: number; method: PaletteMethod; dither: boolean; seed: number };

export interface RateDistortionPoint {
  quality: number;
  bpp: number;
  psnr: number;
  ssim: number;
}

export interface WorkerApi {
  analyze(image: RgbaImage): ImageAnalysis;
  applyOps(image: RgbaImage, ops: OpRequest[]): RgbaImage;
  applySpatial(image: RgbaImage, request: SpatialRequest): RgbaImage;
  spectrum(image: RgbaImage): SpectrumAnalysis;
  applyFrequency(image: RgbaImage, options: FrequencyFilterOptions): RgbaImage;
  compressJpeg(image: RgbaImage, quality: number): JpegResult;
  jpegBlock(
    image: RgbaImage,
    blockX: number,
    blockY: number,
    quality: number,
    channel: JpegChannel,
  ): JpegBlockStages;
  lossless(image: RgbaImage): LosslessReport;
  metricsCompare(a: RgbaImage, b: RgbaImage): MetricsComparison;
  rateDistortion(image: RgbaImage, qualities: number[]): RateDistortionPoint[];
  applyColor(image: RgbaImage, request: ColorRequest): RgbaImage;
  applyMorphology(image: RgbaImage, request: MorphologyRequest): RgbaImage;
  applyGeometry(image: RgbaImage, request: GeometryRequest): RgbaImage;
  applyNoise(image: RgbaImage, request: NoiseRequest): RgbaImage;
  blur(image: RgbaImage, kind: "motion" | "defocus", length: number, angle: number, radius: number): RgbaImage;
  restore(image: RgbaImage, request: RestoreRequest): RgbaImage;
  applyHalftone(image: RgbaImage, request: HalftoneRequest): RgbaImage | PaletteResult;
}

function applySpatialOp(image: RgbaImage, request: SpatialRequest): RgbaImage {
  switch (request.kind) {
    case "mean":
      return meanFilter(image, request.size);
    case "gaussian":
      return gaussianFilter(image, request.size, request.sigma);
    case "median":
      return medianFilter(image, request.radius);
    case "bilateral":
      return bilateralFilter(image, request.radius, request.sigmaSpace, request.sigmaRange);
    case "sharpen":
      return sharpenFilter(image);
    case "unsharp":
      return unsharpMask(image, request.sigma, request.amount);
    case "sobel":
      return sobelMagnitude(image);
    case "prewitt":
      return prewittMagnitude(image);
    case "laplacian":
      return laplacianImage(image);
    case "log":
      return logImage(image, request.sigma);
    case "canny":
      return cannyEdges(image, request.low, request.high, request.sigma);
  }
}

function applyOp(image: RgbaImage, op: OpRequest): RgbaImage {
  switch (op.kind) {
    case "negative":
      return negative(image);
    case "log":
      return logTransform(image);
    case "gamma":
      return gammaCorrect(image, op.gamma);
    case "equalize":
      return equalize(image);
    case "stretch":
      return contrastStretch(image, op.low, op.high);
    case "otsu":
      return threshold(image, otsuThreshold(rgbaToLuma(image)));
    case "threshold":
      return threshold(image, op.cutoff);
    case "clahe":
      return clahe(image, { tiles: op.tiles, clipLimit: op.clipLimit });
    case "quantize":
      return quantizeBits(image, op.bits);
    case "resize": {
      const width = Math.max(1, Math.round(image.width / op.factor));
      const height = Math.max(1, Math.round(image.height / op.factor));
      return resizeNearest(image, width, height);
    }
  }
}

const api: WorkerApi = {
  analyze(image) {
    return {
      stats: planeStats(rgbaToLuma(image)),
      lumaHistogram: lumaHistogram(image),
      channels: [
        byteHistogram(image.data, 0),
        byteHistogram(image.data, 1),
        byteHistogram(image.data, 2),
      ],
    };
  },
  applyOps(image, ops) {
    return ops.reduce(applyOp, image);
  },
  applySpatial(image, request) {
    return applySpatialOp(image, request);
  },
  spectrum(image) {
    const shifted = fftShift(fft2(rgbaToLuma(image)));
    return {
      width: shifted.width,
      height: shifted.height,
      magnitude: fftMagnitude(shifted).data,
      phase: fftPhase(shifted).data,
    };
  },
  applyFrequency(image, options) {
    return applyFrequencyFilter(image, options);
  },
  compressJpeg(image, quality) {
    return jpegReconstruct(image, quality);
  },
  jpegBlock(image, blockX, blockY, quality, channel) {
    return jpegBlockStages(image, blockX, blockY, quality, channel);
  },
  lossless(image) {
    return losslessReport(image);
  },
  metricsCompare(a, b) {
    const ssimResult = ssim(a, b);
    return {
      metrics: compareMetrics(a, b),
      heatmap: errorHeatmap(a, b),
      ssimMap: ssimResult.map,
      width: a.width,
      height: a.height,
    };
  },
  applyColor(image, request) {
    switch (request.kind) {
      case "space":
        return colorSpaceView(image, request.space, request.channel);
      case "subsample":
        return subsampleChroma(image, request.mode);
      case "colorblind":
        return simulateColorBlindness(image, request.deficiency, request.severity);
      case "balance":
        return balanceWhite(image, request.method);
    }
  },
  applyMorphology(image, request) {
    const se = request.mask
      ? {
          size: request.size,
          mask: Uint8Array.from(request.mask),
        }
      : structuringElement(request.size, request.shape);
    return applyMorphology(image, request.kind, se, request.binaryThreshold);
  },
  applyGeometry(image, request) {
    if (request.kind === "transform") return transformImage(image, request.options);
    if (request.kind === "pyramid") {
      return pyramidContactSheet(
        request.laplacian ? laplacianPyramid(image, request.levels) : gaussianPyramid(image, request.levels),
      );
    }
    return multiscaleBlend(
      image,
      transformImage(image, {
        scaleX: 1,
        scaleY: 1,
        rotate: 180,
        translateX: 0,
        translateY: 0,
        shearX: 0,
        shearY: 0,
        perspectiveX: 0,
        perspectiveY: 0,
        interpolation: "bilinear",
      }),
      request.levels,
      request.mix,
    );
  },
  applyNoise(image, request) {
    return addNoise(image, request);
  },
  blur(image, kind, length, angle, radius) {
    return kind === "motion" ? motionBlur(image, length, angle) : defocusBlur(image, radius);
  },
  restore(image, request) {
    switch (request.kind) {
      case "median":
        return medianFilter(image, request.radius);
      case "bilateral":
        return bilateralFilter(image, request.radius, request.sigmaSpace, request.sigmaRange);
      case "wiener-denoise":
        return wienerDenoise(image, request.strength);
      case "inverse":
      case "wiener": {
        const options: DeconvolutionOptions = {
          method: request.kind,
          blur: request.blur,
          length: request.length,
          angle: request.angle,
          radius: request.radius,
          strength: request.strength,
        };
        return deconvolve(image, options);
      }
    }
  },
  applyHalftone(image, request) {
    if (request.kind === "palette") {
      return reducePalette(image, request.colors, request.method, request.dither, request.seed);
    }
    return halftone(image, request.method, request.matrixSize);
  },
  rateDistortion(image, qualities) {
    return qualities.slice(0, 10).map((quality) => {
      const result = jpegReconstruct(image, quality);
      return {
        quality,
        bpp: result.bpp,
        psnr: psnr(image, result.image),
        ssim: ssim(image, result.image).mean,
      };
    });
  },
};

Comlink.expose(api);
