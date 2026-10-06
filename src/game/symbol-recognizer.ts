import type { Drawing, Point } from './types';

export type NormalizedPoint = readonly [number, number];
export type ShapeTemplate = readonly (readonly NormalizedPoint[])[];

export interface SymbolRecognitionResult<T extends string> {
  value: T | 'UNKNOWN';
  confidence: number;
}

interface RecognizerOptions {
  maxTemplateDistance?: number;
  minDistanceMargin?: number;
  rejectVeryHorizontal?: boolean;
}

const MIN_DRAWING_SIZE = 36;
const SAMPLES_PER_TEMPLATE = 72;

function drawingBounds(drawing: Drawing): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const points = drawing.flatMap((stroke) => stroke);
  if (points.length < 2) {
    return null;
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function sampleDrawing(drawing: Drawing, targetCount: number): Point[] {
  const segments: { start: Point; end: Point; length: number }[] = [];
  let totalLength = 0;

  for (const stroke of drawing) {
    for (let index = 1; index < stroke.length; index += 1) {
      const start = stroke[index - 1];
      const end = stroke[index];
      if (!start || !end) {
        continue;
      }
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= 0) {
        continue;
      }
      totalLength += length;
      segments.push({ start, end, length });
    }
  }

  if (segments.length === 0 || totalLength === 0) {
    return drawing.flatMap((stroke) => stroke).slice(0, targetCount);
  }

  const samples: Point[] = [];
  segments.forEach((segment) => {
    const count = Math.max(2, Math.round((segment.length / totalLength) * targetCount));
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0 : index / (count - 1);
      samples.push({
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t,
      });
    }
  });

  return samples;
}

function normalizeDrawing(drawing: Drawing): NormalizedPoint[] | null {
  const bounds = drawingBounds(drawing);
  if (!bounds) {
    return null;
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale = Math.max(width, height);
  if (scale < MIN_DRAWING_SIZE) {
    return null;
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return sampleDrawing(drawing, SAMPLES_PER_TEMPLATE).map((point) => [
    (point.x - centerX) / scale + 0.5,
    (point.y - centerY) / scale + 0.5,
  ] as const);
}

function templatePoints(template: ShapeTemplate): NormalizedPoint[] {
  const drawing: Drawing = template.map((stroke) => stroke.map(([x, y]) => ({ x: x * 100, y: y * 100 })));
  return normalizeDrawing(drawing) ?? [];
}

function nearestDistance(point: NormalizedPoint, candidates: readonly NormalizedPoint[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    best = Math.min(best, Math.hypot(point[0] - candidate[0], point[1] - candidate[1]));
  }
  return best;
}

function chamferDistance(a: readonly NormalizedPoint[], b: readonly NormalizedPoint[]): number {
  if (a.length === 0 || b.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const forward = a.reduce((sum, point) => sum + nearestDistance(point, b), 0) / a.length;
  const backward = b.reduce((sum, point) => sum + nearestDistance(point, a), 0) / b.length;
  return (forward + backward) / 2;
}

export function createSymbolRecognizer<T extends string>(
  symbols: readonly T[],
  templates: Record<T, readonly ShapeTemplate[]>,
  options: RecognizerOptions = {},
): (drawing: Drawing) => SymbolRecognitionResult<T> {
  const maxTemplateDistance = options.maxTemplateDistance ?? 0.19;
  const minDistanceMargin = options.minDistanceMargin ?? 0.012;
  const rejectVeryHorizontal = options.rejectVeryHorizontal ?? true;
  const normalizedTemplates = Object.fromEntries(
    symbols.map((symbol) => [symbol, templates[symbol].map(templatePoints)]),
  ) as unknown as Record<T, readonly NormalizedPoint[][]>;

  return (drawing: Drawing): SymbolRecognitionResult<T> => {
    const bounds = drawingBounds(drawing);
    if (!bounds) {
      return { value: 'UNKNOWN', confidence: 0 };
    }

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (rejectVeryHorizontal && width > Math.max(height, 1) * 4) {
      return { value: 'UNKNOWN', confidence: 0 };
    }

    const normalized = normalizeDrawing(drawing);
    if (!normalized) {
      return { value: 'UNKNOWN', confidence: 0 };
    }

    const scores = symbols.map((symbol) => ({
      symbol,
      distance: Math.min(...normalizedTemplates[symbol].map((template) => chamferDistance(normalized, template))),
    })).sort((a, b) => a.distance - b.distance);

    const best = scores[0];
    const second = scores[1];
    if (!best || best.distance > maxTemplateDistance) {
      return { value: 'UNKNOWN', confidence: 0 };
    }

    const margin = (second?.distance ?? 1) - best.distance;
    const confidence = Math.max(0, Math.min(1, 1 - best.distance / maxTemplateDistance));
    if (margin < minDistanceMargin) {
      return { value: 'UNKNOWN', confidence: confidence * 0.5 };
    }

    return { value: best.symbol, confidence };
  };
}
