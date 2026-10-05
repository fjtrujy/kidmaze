import { describe, expect, it } from 'vitest';
import { LetterRecognizer } from './letter-recognizer';
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
  A: [
    interpolate([{ x: 20, y: 95 }, { x: 55, y: 10 }]),
    interpolate([{ x: 55, y: 10 }, { x: 90, y: 95 }]),
    interpolate([{ x: 34, y: 58 }, { x: 75, y: 58 }]),
  ],
  B: [
    interpolate([{ x: 24, y: 10 }, { x: 24, y: 96 }]),
    interpolate([
      { x: 24, y: 10 },
      { x: 66, y: 10 },
      { x: 88, y: 24 },
      { x: 84, y: 42 },
      { x: 62, y: 51 },
      { x: 24, y: 51 },
    ]),
    interpolate([
      { x: 24, y: 51 },
      { x: 66, y: 51 },
      { x: 91, y: 65 },
      { x: 86, y: 87 },
      { x: 62, y: 96 },
      { x: 24, y: 96 },
    ]),
  ],
  E: [
    interpolate([{ x: 22, y: 10 }, { x: 22, y: 96 }]),
    interpolate([{ x: 22, y: 10 }, { x: 88, y: 10 }]),
    interpolate([{ x: 22, y: 52 }, { x: 72, y: 52 }]),
    interpolate([{ x: 22, y: 96 }, { x: 90, y: 96 }]),
  ],
  I: [interpolate([{ x: 52, y: 12 }, { x: 50, y: 98 }])],
  L: [interpolate([{ x: 28, y: 10 }, { x: 28, y: 94 }, { x: 88, y: 94 }])],
  M: [interpolate([
    { x: 14, y: 96 },
    { x: 14, y: 10 },
    { x: 52, y: 58 },
    { x: 90, y: 10 },
    { x: 90, y: 96 },
  ])],
  O: [interpolate([
    { x: 52, y: 8 },
    { x: 24, y: 15 },
    { x: 10, y: 45 },
    { x: 17, y: 80 },
    { x: 50, y: 96 },
    { x: 84, y: 80 },
    { x: 94, y: 44 },
    { x: 80, y: 14 },
    { x: 52, y: 8 },
  ])],
  T: [
    interpolate([{ x: 16, y: 12 }, { x: 90, y: 12 }]),
    interpolate([{ x: 53, y: 12 }, { x: 53, y: 96 }]),
  ],
  X: [
    interpolate([{ x: 14, y: 12 }, { x: 90, y: 96 }]),
    interpolate([{ x: 88, y: 10 }, { x: 15, y: 95 }]),
  ],
};

describe('LetterRecognizer', () => {
  const recognizer = new LetterRecognizer();

  it.each(Object.entries(DRAWINGS))('recognizes %s', (letter, drawing) => {
    expect(recognizer.recognize(drawing).letter).toBe(letter);
  });

  it('rejects a tiny mark', () => {
    expect(recognizer.recognize([[{ x: 10, y: 10 }, { x: 18, y: 16 }]]).letter).toBe('UNKNOWN');
  });

  it('rejects a plain horizontal line', () => {
    const line = interpolate([{ x: 12, y: 50 }, { x: 96, y: 50 }]);
    expect(recognizer.recognize([line]).letter).toBe('UNKNOWN');
  });
});

