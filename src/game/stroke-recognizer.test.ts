import { describe, expect, it } from 'vitest';
import { StrokeRecognizer } from './stroke-recognizer';
import type { Direction, Drawing, Point } from './types';

function interpolate(vertices: readonly Point[], stepsPerSegment = 12): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < vertices.length - 1; index += 1) {
    const start = vertices[index];
    const end = vertices[index + 1];
    if (!start || !end) {
      continue;
    }
    for (let step = 0; step < stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }
  const last = vertices[vertices.length - 1];
  if (last) {
    points.push(last);
  }
  return points;
}

const ARROWS: Record<Direction, readonly Point[]> = {
  RIGHT: [
    { x: 15, y: 55 },
    { x: 92, y: 55 },
    { x: 68, y: 30 },
    { x: 92, y: 55 },
    { x: 66, y: 82 },
  ],
  LEFT: [
    { x: 95, y: 55 },
    { x: 18, y: 55 },
    { x: 43, y: 30 },
    { x: 18, y: 55 },
    { x: 45, y: 82 },
  ],
  DOWN: [
    { x: 55, y: 12 },
    { x: 55, y: 93 },
    { x: 30, y: 67 },
    { x: 55, y: 93 },
    { x: 82, y: 66 },
  ],
  UP: [
    { x: 55, y: 94 },
    { x: 55, y: 14 },
    { x: 29, y: 41 },
    { x: 55, y: 14 },
    { x: 81, y: 43 },
  ],
};

const MULTI_STROKE_ARROWS: Record<Direction, Drawing> = {
  RIGHT: [
    interpolate([
      { x: 15, y: 55 },
      { x: 92, y: 55 },
    ]),
    interpolate([
      { x: 68, y: 30 },
      { x: 92, y: 55 },
    ]),
    interpolate([
      { x: 92, y: 55 },
      { x: 66, y: 82 },
    ]),
  ],
  LEFT: [
    interpolate([
      { x: 95, y: 55 },
      { x: 18, y: 55 },
    ]),
    interpolate([
      { x: 43, y: 30 },
      { x: 18, y: 55 },
    ]),
    interpolate([
      { x: 18, y: 55 },
      { x: 45, y: 82 },
    ]),
  ],
  DOWN: [
    interpolate([
      { x: 55, y: 12 },
      { x: 55, y: 93 },
    ]),
    interpolate([
      { x: 30, y: 67 },
      { x: 55, y: 93 },
    ]),
    interpolate([
      { x: 55, y: 93 },
      { x: 82, y: 66 },
    ]),
  ],
  UP: [
    interpolate([
      { x: 55, y: 94 },
      { x: 55, y: 14 },
    ]),
    interpolate([
      { x: 29, y: 41 },
      { x: 55, y: 14 },
    ]),
    interpolate([
      { x: 55, y: 14 },
      { x: 81, y: 43 },
    ]),
  ],
};

describe('StrokeRecognizer', () => {
  const recognizer = new StrokeRecognizer();

  it.each(Object.entries(ARROWS) as [Direction, readonly Point[]][])(
    'recognizes a hand-drawn style %s arrow',
    (direction, vertices) => {
      expect(recognizer.recognize([interpolate(vertices)]).direction).toBe(direction);
    },
  );

  it.each(Object.entries(MULTI_STROKE_ARROWS) as [Direction, Drawing][])(
    'recognizes a %s arrow drawn as separate shaft and arrowhead strokes',
    (direction, drawing) => {
      expect(recognizer.recognize(drawing).direction).toBe(direction);
    },
  );

  it('rejects a plain line without an arrowhead', () => {
    const line = interpolate([
      { x: 10, y: 50 },
      { x: 100, y: 50 },
    ]);
    expect(recognizer.recognize([line]).direction).toBe('UNKNOWN');
  });

  it('rejects tiny accidental marks', () => {
    const mark = interpolate([
      { x: 10, y: 10 },
      { x: 25, y: 20 },
      { x: 20, y: 30 },
    ]);
    expect(recognizer.recognize([mark]).direction).toBe('UNKNOWN');
  });
});

