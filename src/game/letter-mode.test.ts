import { describe, expect, it } from 'vitest';
import letterConflicts from './letter-conflicts.json';
import { createLetterAssignments, LETTER_ALPHABET, positionKey, walkableNeighbors } from './letter-mode';
import { LEVELS } from './levels';
import { parseLevel } from './maze';

describe('letter mode', () => {
  it('uses the complete uppercase English alphabet', () => {
    expect(LETTER_ALPHABET.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

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

  it('never presents model-derived confusing pairs as neighboring choices', () => {
    for (const definition of LEVELS) {
      const level = parseLevel(definition);
      let state = 0x5eed;
      const random = (): number => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
      };
      const assignments = createLetterAssignments(level, random);

      for (let row = 0; row < level.rows; row += 1) {
        for (let col = 0; col < level.cols; col += 1) {
          if (!level.walkable[row]?.[col]) {
            continue;
          }
          const choices = walkableNeighbors(level, { row, col })
            .map((neighbor) => assignments.get(positionKey(neighbor)))
            .filter((letter): letter is NonNullable<typeof letter> => letter !== undefined);
          for (const [left, right] of letterConflicts) {
            const hasLeft = choices.some((choice) => choice === left);
            const hasRight = choices.some((choice) => choice === right);
            expect(hasLeft && hasRight).toBe(false);
          }
        }
      }
    }
  });
});

