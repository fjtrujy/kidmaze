import type { InferenceSession } from 'onnxruntime-web';
import { LETTER_ALPHABET, type Letter } from './letter-mode';
import { NUMBER_DIGITS, type NumberDigit } from './number-mode';
import modelConfig from './symbol-model-config.json';
import type { Drawing, Point } from './types';

export type HandwritingSymbol = Letter | NumberDigit;

export interface HandwritingRecognitionResult {
  value: HandwritingSymbol | 'UNKNOWN';
  confidence: number;
  available: boolean;
}

const MODEL_LABELS = modelConfig.labels as HandwritingSymbol[];
const IMAGE_SIZE = modelConfig.imageSize;
const CONTENT_SIZE = modelConfig.contentSize;
const NORMALIZATION_MEAN = modelConfig.mean;
const NORMALIZATION_STD = modelConfig.std;
const BRUSH_RADIUS = 1.35;
const MIN_SINGLE_CANDIDATE_MODE_PROBABILITY = 0.12;
const MIN_MULTI_CANDIDATE_MODE_PROBABILITY = 0.02;
const MIN_PAIR_CONFIDENCE = 0.58;
const ORT_WASM_URL = new URL(
  '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
  import.meta.url,
).href;

interface LoadedRuntime {
  ort: typeof import('onnxruntime-web/wasm');
  session: InferenceSession;
}

function isNumberDigit(symbol: HandwritingSymbol): symbol is NumberDigit {
  return NUMBER_DIGITS.includes(symbol as NumberDigit);
}

function modelIndex(symbol: HandwritingSymbol): number {
  return MODEL_LABELS.indexOf(symbol);
}

function softmaxForIndices(logits: readonly number[], indices: readonly number[]): Map<number, number> {
  const maxLogit = Math.max(...indices.map((index) => logits[index] ?? Number.NEGATIVE_INFINITY));
  const weights = indices.map((index) => Math.exp((logits[index] ?? Number.NEGATIVE_INFINITY) - maxLogit));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return new Map(indices.map((index, offset) => [index, (weights[offset] ?? 0) / sum]));
}

export function selectHandwritingCandidate(
  logits: readonly number[],
  candidates: readonly HandwritingSymbol[],
): Omit<HandwritingRecognitionResult, 'available'> {
  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length === 0 || logits.length !== MODEL_LABELS.length) {
    return { value: 'UNKNOWN', confidence: 0 };
  }

  const numberMode = uniqueCandidates.every(isNumberDigit);
  const modeLabels: readonly HandwritingSymbol[] = numberMode ? NUMBER_DIGITS : LETTER_ALPHABET;
  const modeIndices = modeLabels.map(modelIndex).filter((index) => index >= 0);
  const modeProbabilities = softmaxForIndices(logits, modeIndices);
  const rankedCandidates = uniqueCandidates
    .map((value) => {
      const index = modelIndex(value);
      return {
        value,
        index,
        probability: index >= 0 ? modeProbabilities.get(index) ?? 0 : 0,
        logit: index >= 0 ? logits[index] ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((left, right) => right.logit - left.logit);

  const best = rankedCandidates[0];
  const minimumModeProbability = rankedCandidates.length === 1
    ? MIN_SINGLE_CANDIDATE_MODE_PROBABILITY
    : MIN_MULTI_CANDIDATE_MODE_PROBABILITY;
  if (!best || best.probability < minimumModeProbability) {
    return { value: 'UNKNOWN', confidence: best?.probability ?? 0 };
  }

  if (rankedCandidates.length === 1) {
    return { value: best.value, confidence: best.probability };
  }

  const second = rankedCandidates[1];
  if (!second) {
    return { value: best.value, confidence: best.probability };
  }
  const maxPairLogit = Math.max(best.logit, second.logit);
  const bestWeight = Math.exp(best.logit - maxPairLogit);
  const secondWeight = Math.exp(second.logit - maxPairLogit);
  const pairConfidence = bestWeight / (bestWeight + secondWeight);
  if (pairConfidence < MIN_PAIR_CONFIDENCE) {
    return { value: 'UNKNOWN', confidence: pairConfidence };
  }

  return { value: best.value, confidence: pairConfidence };
}

function paintBrush(pixels: Float32Array, x: number, y: number): void {
  const reach = Math.ceil(BRUSH_RADIUS + 1);
  const minX = Math.max(0, Math.floor(x) - reach);
  const maxX = Math.min(IMAGE_SIZE - 1, Math.ceil(x) + reach);
  const minY = Math.max(0, Math.floor(y) - reach);
  const maxY = Math.min(IMAGE_SIZE - 1, Math.ceil(y) + reach);

  for (let row = minY; row <= maxY; row += 1) {
    for (let col = minX; col <= maxX; col += 1) {
      const distance = Math.hypot(col + 0.5 - x, row + 0.5 - y);
      const coverage = Math.max(0, Math.min(1, BRUSH_RADIUS + 0.65 - distance));
      const index = row * IMAGE_SIZE + col;
      pixels[index] = Math.max(pixels[index] ?? 0, coverage);
    }
  }
}

function drawSegment(pixels: Float32Array, from: Point, to: Point): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance * 2));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    paintBrush(
      pixels,
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
    );
  }
}

function centerOfMass(pixels: Float32Array): { x: number; y: number } | null {
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let row = 0; row < IMAGE_SIZE; row += 1) {
    for (let col = 0; col < IMAGE_SIZE; col += 1) {
      const weight = pixels[row * IMAGE_SIZE + col] ?? 0;
      total += weight;
      weightedX += (col + 0.5) * weight;
      weightedY += (row + 0.5) * weight;
    }
  }
  return total > 0 ? { x: weightedX / total, y: weightedY / total } : null;
}

function shiftedPixels(pixels: Float32Array): Float32Array {
  const center = centerOfMass(pixels);
  if (!center) {
    return pixels;
  }
  const offsetX = Math.round(IMAGE_SIZE / 2 - center.x);
  const offsetY = Math.round(IMAGE_SIZE / 2 - center.y);
  if (offsetX === 0 && offsetY === 0) {
    return pixels;
  }

  const shifted = new Float32Array(pixels.length);
  for (let row = 0; row < IMAGE_SIZE; row += 1) {
    for (let col = 0; col < IMAGE_SIZE; col += 1) {
      const targetX = col + offsetX;
      const targetY = row + offsetY;
      if (targetX >= 0 && targetX < IMAGE_SIZE && targetY >= 0 && targetY < IMAGE_SIZE) {
        shifted[targetY * IMAGE_SIZE + targetX] = pixels[row * IMAGE_SIZE + col] ?? 0;
      }
    }
  }
  return shifted;
}

export function rasterizeDrawingForModel(drawing: Drawing): Float32Array | null {
  const points = drawing.flatMap((stroke) => stroke);
  if (points.length < 2) {
    return null;
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  const largestDimension = Math.max(width, height);
  if (largestDimension < 8) {
    return null;
  }

  const scale = CONTENT_SIZE / Math.max(1, largestDimension);
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (IMAGE_SIZE - scaledWidth) / 2;
  const offsetY = (IMAGE_SIZE - scaledHeight) / 2;
  const transform = (point: Point): Point => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale,
  });

  const pixels = new Float32Array(IMAGE_SIZE * IMAGE_SIZE);
  for (const stroke of drawing) {
    if (stroke.length === 0) {
      continue;
    }
    if (stroke.length === 1) {
      paintBrush(pixels, transform(stroke[0]!).x, transform(stroke[0]!).y);
      continue;
    }
    for (let index = 1; index < stroke.length; index += 1) {
      drawSegment(pixels, transform(stroke[index - 1]!), transform(stroke[index]!));
    }
  }

  const centered = shiftedPixels(pixels);
  return Float32Array.from(
    centered,
    (value) => (value - NORMALIZATION_MEAN) / NORMALIZATION_STD,
  );
}

export class HandwritingRecognizer {
  private runtimePromise: Promise<LoadedRuntime> | null = null;
  private unavailable = false;

  preload(): Promise<boolean> {
    return this.getRuntime().then(() => true).catch(() => false);
  }

  async recognize(
    drawing: Drawing,
    candidates: readonly HandwritingSymbol[],
  ): Promise<HandwritingRecognitionResult> {
    const image = rasterizeDrawingForModel(drawing);
    if (!image || candidates.length === 0) {
      return { value: 'UNKNOWN', confidence: 0, available: !this.unavailable };
    }

    try {
      const { ort, session } = await this.getRuntime();
      const input = new ort.Tensor('float32', image, [1, 1, IMAGE_SIZE, IMAGE_SIZE]);
      const outputs = await session.run({ input });
      const output = outputs.logits;
      if (!output) {
        throw new Error('Handwriting model did not return logits.');
      }
      const logits = Array.from(output.data as Float32Array);
      return { ...selectHandwritingCandidate(logits, candidates), available: true };
    } catch (error) {
      if (!this.unavailable) {
        console.warn('Handwriting ML recognizer unavailable; using geometric fallback.', error);
      }
      this.unavailable = true;
      return { value: 'UNKNOWN', confidence: 0, available: false };
    }
  }

  private getRuntime(): Promise<LoadedRuntime> {
    if (this.unavailable) {
      return Promise.reject(new Error('Handwriting recognizer is unavailable.'));
    }
    if (!this.runtimePromise) {
      this.runtimePromise = this.loadRuntime().catch((error) => {
        this.runtimePromise = null;
        throw error;
      });
    }
    return this.runtimePromise;
  }

  private async loadRuntime(): Promise<LoadedRuntime> {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = {
      wasm: ORT_WASM_URL,
    };
    const session = await ort.InferenceSession.create(
      new URL('models/kidmaze-symbols.onnx', document.baseURI).href,
      { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
    );
    return { ort, session };
  }
}
