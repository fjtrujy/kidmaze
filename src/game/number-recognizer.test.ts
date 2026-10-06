import { describe, expect, it } from 'vitest';
import { NumberRecognizer } from './number-recognizer';
import type { Drawing, Point } from './types';

function interpolate(vertices: readonly Point[], steps = 12): Point[] {
  const points: Point[] = [];
  for (let index = 1; index < vertices.length; index += 1) {
    const start = vertices[index - 1];
    const end = vertices[index];
    if (!start || !end) {
      continue;
    }
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
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

const DRAWINGS: Record<string, Drawing> = {
  '0': [interpolate([
    { x: 52, y: 8 }, { x: 25, y: 15 }, { x: 13, y: 43 }, { x: 18, y: 79 },
    { x: 48, y: 96 }, { x: 80, y: 82 }, { x: 91, y: 47 }, { x: 80, y: 15 }, { x: 52, y: 8 },
  ])],
  '1': [interpolate([{ x: 40, y: 25 }, { x: 54, y: 10 }, { x: 53, y: 96 }])],
  '2': [interpolate([
    { x: 15, y: 28 }, { x: 30, y: 10 }, { x: 62, y: 8 }, { x: 86, y: 23 },
    { x: 80, y: 43 }, { x: 20, y: 92 }, { x: 90, y: 92 },
  ])],
  '3': [interpolate([
    { x: 18, y: 15 }, { x: 48, y: 7 }, { x: 82, y: 20 }, { x: 70, y: 48 },
    { x: 48, y: 52 }, { x: 76, y: 56 }, { x: 86, y: 79 }, { x: 65, y: 96 }, { x: 20, y: 87 },
  ])],
  '4': [
    interpolate([{ x: 72, y: 8 }, { x: 18, y: 62 }, { x: 91, y: 62 }]),
    interpolate([{ x: 72, y: 8 }, { x: 72, y: 96 }]),
  ],
  '5': [interpolate([
    { x: 84, y: 10 }, { x: 24, y: 10 }, { x: 22, y: 48 }, { x: 55, y: 46 },
    { x: 82, y: 58 }, { x: 86, y: 80 }, { x: 68, y: 95 }, { x: 39, y: 96 }, { x: 17, y: 84 },
  ])],
  '6': [interpolate([
    { x: 79, y: 12 }, { x: 55, y: 8 }, { x: 30, y: 22 }, { x: 17, y: 50 },
    { x: 21, y: 78 }, { x: 48, y: 96 }, { x: 76, y: 85 }, { x: 84, y: 63 },
    { x: 70, y: 49 }, { x: 45, y: 47 }, { x: 22, y: 60 },
  ])],
  '7': [interpolate([{ x: 13, y: 12 }, { x: 90, y: 12 }, { x: 58, y: 52 }, { x: 34, y: 96 }])],
  '8': [interpolate([
    { x: 50, y: 50 }, { x: 27, y: 41 }, { x: 20, y: 20 }, { x: 35, y: 7 }, { x: 53, y: 6 },
    { x: 77, y: 16 }, { x: 78, y: 35 }, { x: 65, y: 45 }, { x: 50, y: 50 },
    { x: 27, y: 60 }, { x: 17, y: 79 }, { x: 34, y: 95 }, { x: 55, y: 96 },
    { x: 82, y: 83 }, { x: 80, y: 63 }, { x: 64, y: 53 }, { x: 50, y: 50 },
  ])],
  '9': [interpolate([
    { x: 78, y: 50 }, { x: 52, y: 55 }, { x: 27, y: 45 }, { x: 18, y: 25 },
    { x: 32, y: 9 }, { x: 56, y: 7 }, { x: 80, y: 18 }, { x: 87, y: 41 },
    { x: 80, y: 66 }, { x: 66, y: 84 }, { x: 42, y: 97 },
  ])],
};

describe('NumberRecognizer', () => {
  const recognizer = new NumberRecognizer();

  it.each(Object.entries(DRAWINGS))('recognizes %s', (digit, drawing) => {
    expect(recognizer.recognize(drawing).digit).toBe(digit);
  });

  it('rejects a tiny mark', () => {
    expect(recognizer.recognize([[{ x: 10, y: 10 }, { x: 18, y: 16 }]]).digit).toBe('UNKNOWN');
  });

  it('rejects a plain horizontal line', () => {
    const line = interpolate([{ x: 12, y: 50 }, { x: 96, y: 50 }]);
    expect(recognizer.recognize([line]).digit).toBe('UNKNOWN');
  });
});
