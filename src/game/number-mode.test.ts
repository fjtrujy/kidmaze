import { describe, expect, it } from 'vitest';
import { positionKey, walkableNeighbors } from './letter-mode';
import { LEVELS } from './levels';
import { parseLevel } from './maze';
import { createNumberAssignments, NUMBER_DIGITS } from './number-mode';

describe('number mode', () => {
  it('uses all decimal digits and keeps adjacent choices distinct', () => {
    expect(NUMBER_DIGITS).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    for (const definition of LEVELS) {
      const level = parseLevel(definition);
      const assignments = createNumberAssignments(level, () => 0.58);

      for (let row = 0; row < level.rows; row += 1) {
        for (let col = 0; col < level.cols; col += 1) {
          if (!level.walkable[row]?.[col]) {
            continue;
          }
          const position = { row, col };
          expect(assignments.get(positionKey(position))).toBeDefined();
          const neighborDigits = walkableNeighbors(level, position).map((neighbor) =>
            assignments.get(positionKey(neighbor)),
          );
          expect(new Set(neighborDigits).size).toBe(neighborDigits.length);
        }
      }
    }
  });
});
