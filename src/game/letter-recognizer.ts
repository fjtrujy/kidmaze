import { LETTER_ALPHABET, type Letter } from './letter-mode';
import type { Drawing, Point } from './types';

export interface LetterRecognitionResult {
  letter: Letter | 'UNKNOWN';
  confidence: number;
}

type NormalizedPoint = readonly [number, number];
type LetterTemplate = readonly (readonly NormalizedPoint[])[];

const MIN_DRAWING_SIZE = 36;
const SAMPLES_PER_TEMPLATE = 72;
const MAX_TEMPLATE_DISTANCE = 0.19;
const MIN_DISTANCE_MARGIN = 0.018;

const LETTER_TEMPLATES: Record<Letter, readonly LetterTemplate[]> = {
  A: [
    [
      [[0.12, 1], [0.5, 0]],
      [[0.5, 0], [0.88, 1]],
      [[0.28, 0.58], [0.72, 0.58]],
    ],
  ],
  I: [
    [[[0.5, 0], [0.5, 1]]],
    [
      [[0.18, 0], [0.82, 0]],
      [[0.5, 0], [0.5, 1]],
      [[0.18, 1], [0.82, 1]],
    ],
  ],
  L: [
    [[[0.22, 0], [0.22, 1], [0.88, 1]]],
    [
      [[0.22, 0], [0.22, 1]],
      [[0.22, 1], [0.88, 1]],
    ],
  ],
  O: [
    [[
      [0.5, 0], [0.2, 0.08], [0.04, 0.32], [0.04, 0.68], [0.2, 0.92], [0.5, 1],
      [0.8, 0.92], [0.96, 0.68], [0.96, 0.32], [0.8, 0.08], [0.5, 0],
    ]],
  ],
  T: [
    [
      [[0.08, 0.08], [0.92, 0.08]],
      [[0.5, 0.08], [0.5, 1]],
    ],
  ],
  X: [
    [
      [[0.08, 0.04], [0.92, 0.96]],
      [[0.92, 0.04], [0.08, 0.96]],
    ],
  ],
};

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

function templatePoints(template: LetterTemplate): NormalizedPoint[] {
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

const NORMALIZED_TEMPLATES = Object.fromEntries(
  LETTER_ALPHABET.map((letter) => [letter, LETTER_TEMPLATES[letter].map(templatePoints)]),
) as unknown as Record<Letter, readonly NormalizedPoint[][]>;

export class LetterRecognizer {
  recognize(drawing: Drawing): LetterRecognitionResult {
    const bounds = drawingBounds(drawing);
    if (!bounds) {
      return { letter: 'UNKNOWN', confidence: 0 };
    }
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    // The supported alphabet contains a vertical I, but no letter that should
    // collapse into a near-horizontal dash. Reject those early instead of
    // letting point-cloud normalization stretch them into another template.
    if (width > Math.max(height, 1) * 4) {
      return { letter: 'UNKNOWN', confidence: 0 };
    }

    const normalized = normalizeDrawing(drawing);
    if (!normalized) {
      return { letter: 'UNKNOWN', confidence: 0 };
    }

    const scores = LETTER_ALPHABET.map((letter) => ({
      letter,
      distance: Math.min(...NORMALIZED_TEMPLATES[letter].map((template) => chamferDistance(normalized, template))),
    })).sort((a, b) => a.distance - b.distance);

    const best = scores[0];
    const second = scores[1];
    if (!best || best.distance > MAX_TEMPLATE_DISTANCE) {
      return { letter: 'UNKNOWN', confidence: 0 };
    }

    const margin = (second?.distance ?? 1) - best.distance;
    if (margin < MIN_DISTANCE_MARGIN) {
      return { letter: 'UNKNOWN', confidence: Math.max(0, 1 - best.distance / MAX_TEMPLATE_DISTANCE) * 0.5 };
    }

    return {
      letter: best.letter,
      confidence: Math.max(0, Math.min(1, 1 - best.distance / MAX_TEMPLATE_DISTANCE)),
    };
  }
}

