import type { Drawing, Point, RecognitionResult } from './types';

const MIN_POINT_DISTANCE = 2;
const MIN_STROKE_SIZE = 42;
const MIN_ASPECT_RATIO = 1.12;
const HEAD_REGION_FRACTION = 0.38;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function spread(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function deduplicate(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || distance(previous, point) >= MIN_POINT_DISTANCE) {
      result.push(point);
    }
  }
  return result;
}

interface AxisSample {
  along: number;
  across: number;
}

interface AxisAnalysis {
  negativeSpread: number;
  positiveSpread: number;
  acrossSpan: number;
  alongSpan: number;
  centerLine: number;
}

function analyzeAxis(samples: readonly AxisSample[]): AxisAnalysis {
  const alongValues = samples.map((sample) => sample.along);
  const acrossValues = samples.map((sample) => sample.across);
  const minAlong = Math.min(...alongValues);
  const maxAlong = Math.max(...alongValues);
  const alongSpan = maxAlong - minAlong;
  const acrossSpan = spread(acrossValues);
  const centerLine = median(acrossValues);
  const regionSize = alongSpan * HEAD_REGION_FRACTION;

  const negativeAcross = samples
    .filter((sample) => sample.along <= minAlong + regionSize)
    .map((sample) => sample.across);
  const positiveAcross = samples
    .filter((sample) => sample.along >= maxAlong - regionSize)
    .map((sample) => sample.across);

  return {
    negativeSpread: spread(negativeAcross),
    positiveSpread: spread(positiveAcross),
    acrossSpan,
    alongSpan,
    centerLine,
  };
}

function variance(values: readonly number[]): number {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
}

function unknown(confidence = 0): RecognitionResult {
  return { direction: 'UNKNOWN', confidence };
}

export class StrokeRecognizer {
  recognize(drawing: Drawing): RecognitionResult {
    const rawPoints = drawing.flatMap((stroke) => stroke);
    const points = deduplicate(rawPoints);
    if (points.length < 6) {
      return unknown();
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const width = spread(xs);
    const height = spread(ys);
    const largestDimension = Math.max(width, height);

    if (largestDimension < MIN_STROKE_SIZE) {
      return unknown();
    }

    const varianceX = variance(xs);
    const varianceY = variance(ys);
    const horizontal = varianceX > varianceY;
    const dominantVariance = Math.max(varianceX, varianceY);
    const secondaryVariance = Math.min(varianceX, varianceY);
    const axisRatio = Math.sqrt(dominantVariance / Math.max(secondaryVariance, 0.0001));

    if (axisRatio < MIN_ASPECT_RATIO) {
      return unknown(0.1);
    }

    const samples: AxisSample[] = points.map((point) =>
      horizontal ? { along: point.x, across: point.y } : { along: point.y, across: point.x },
    );
    const analysis = analyzeAxis(samples);

    if (analysis.alongSpan < MIN_STROKE_SIZE || analysis.acrossSpan < analysis.alongSpan * 0.12) {
      return unknown(0.15);
    }

    const largerHeadSpread = Math.max(analysis.negativeSpread, analysis.positiveSpread);
    const smallerHeadSpread = Math.min(analysis.negativeSpread, analysis.positiveSpread);
    const spreadDifference = largerHeadSpread - smallerHeadSpread;
    const normalizedDifference = spreadDifference / Math.max(analysis.acrossSpan, 1);
    const headCoverage = largerHeadSpread / Math.max(analysis.acrossSpan, 1);

    // A real arrow has its widest off-axis strokes near the arrowhead. Comparing
    // the two ends makes recognition independent from drawing order and tolerant
    // of children retracing the tip or drawing the head before the shaft.
    if (headCoverage < 0.58 || normalizedDifference < 0.16) {
      return unknown(Math.max(0.2, normalizedDifference));
    }

    const positiveIsHead = analysis.positiveSpread > analysis.negativeSpread;
    let direction: RecognitionResult['direction'];
    if (horizontal) {
      direction = positiveIsHead ? 'RIGHT' : 'LEFT';
    } else {
      direction = positiveIsHead ? 'DOWN' : 'UP';
    }

    const axisConfidence = Math.min(1, (axisRatio - 1) / 1.25);
    const headConfidence = Math.min(1, normalizedDifference / 0.65);
    const confidence = Math.max(0, Math.min(1, axisConfidence * 0.45 + headConfidence * 0.55));

    return confidence >= 0.32 ? { direction, confidence } : unknown(confidence);
  }
}

