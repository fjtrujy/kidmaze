import { describe, expect, it } from 'vitest';
import { createLetterAssignments, positionKey, walkableNeighbors } from './letter-mode';
import { LEVELS } from './levels';
import { parseLevel } from './maze';

describe('letter mode', () => {
  it('assigns a letter to every walkable cell and keeps adjacent choices distinct', () => {
    for (const definition of LEVELS) {
      const level = parseLevel(definition);
      const assignments = createLetterAssignments(level, () => 0.42);

      let walkableCount = 0;
      for (let row = 0; row < level.rows; row += 1) {
        for (let col = 0; col < level.cols; col += 1) {
          if (!level.walkable[row]?.[col]) {
            continue;
          }
          walkableCount += 1;
          const position = { row, col };
          const letter = assignments.get(positionKey(position));
          expect(letter).toBeDefined();
          const neighborLetters = walkableNeighbors(level, position).map((neighbor) =>
            assignments.get(positionKey(neighbor)),
          );
          expect(new Set(neighborLetters).size).toBe(neighborLetters.length);
        }
      }

      expect(assignments.size).toBe(walkableCount);
    }
  });

  it('keeps every authored maze trail to at most two letter choices', () => {
    for (const definition of LEVELS) {
      const level = parseLevel(definition);
      for (let row = 0; row < level.rows; row += 1) {
        for (let col = 0; col < level.cols; col += 1) {
          if (level.walkable[row]?.[col]) {
            expect(walkableNeighbors(level, { row, col }).length).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

