import type { ParsedMazeLevel, Position } from './types';

export const LETTER_ALPHABET = ['A', 'I', 'L', 'O', 'T', 'X'] as const;

export type Letter = (typeof LETTER_ALPHABET)[number];

const NEIGHBOR_DELTAS: readonly Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

export function walkableNeighbors(level: ParsedMazeLevel, position: Position): Position[] {
  return NEIGHBOR_DELTAS.map((delta) => ({
    row: position.row + delta.row,
    col: position.col + delta.col,
  })).filter(
    (candidate) =>
      candidate.row >= 0
      && candidate.row < level.rows
      && candidate.col >= 0
      && candidate.col < level.cols
      && level.walkable[candidate.row]?.[candidate.col] === true,
  );
}

export function createLetterAssignments(
  level: ParsedMazeLevel,
  random: () => number = Math.random,
): ReadonlyMap<string, Letter> {
  const assignments = new Map<string, Letter>();

  for (let row = 0; row < level.rows; row += 1) {
    for (let col = 0; col < level.cols; col += 1) {
      if (!level.walkable[row]?.[col]) {
        continue;
      }

      const position = { row, col };
      const nearbyPositions = walkableNeighbors(level, position).flatMap((neighbor) => [
        neighbor,
        ...walkableNeighbors(level, neighbor),
      ]);
      const forbidden = new Set(
        nearbyPositions
          .map((neighbor) => assignments.get(positionKey(neighbor)))
          .filter((letter): letter is Letter => letter !== undefined),
      );
      const available = LETTER_ALPHABET.filter((letter) => !forbidden.has(letter));
      const choiceIndex = Math.min(available.length - 1, Math.floor(random() * available.length));
      assignments.set(positionKey(position), available[Math.max(0, choiceIndex)] ?? LETTER_ALPHABET[0]);
    }
  }

  return assignments;
}

