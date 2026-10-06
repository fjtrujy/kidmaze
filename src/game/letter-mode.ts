import type { ParsedMazeLevel, Position } from './types';

export const LETTER_ALPHABET = ['A', 'B', 'E', 'I', 'L', 'M', 'O', 'T', 'X'] as const;

export type Letter = (typeof LETTER_ALPHABET)[number];

const CONFUSABLE_LETTER_PAIRS = new Set(['I:L', 'L:I']);

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
  return createChoiceAssignments(
    level,
    LETTER_ALPHABET,
    random,
    (left, right) => CONFUSABLE_LETTER_PAIRS.has(`${left}:${right}`),
  );
}

export function createChoiceAssignments<T extends string>(
  level: ParsedMazeLevel,
  choices: readonly T[],
  random: () => number = Math.random,
  conflicts: (left: T, right: T) => boolean = () => false,
): ReadonlyMap<string, T> {
  const assignments = new Map<string, T>();

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
      const nearbyChoices = nearbyPositions
        .map((neighbor) => assignments.get(positionKey(neighbor)))
        .filter((choice): choice is T => choice !== undefined);
      const available = choices.filter(
        (choice) => !nearbyChoices.some((nearby) => nearby === choice || conflicts(choice, nearby)),
      );
      const choiceIndex = Math.min(available.length - 1, Math.floor(random() * available.length));
      const fallback = choices[0];
      if (!fallback) {
        throw new Error('Choice mode requires at least one symbol.');
      }
      assignments.set(positionKey(position), available[Math.max(0, choiceIndex)] ?? fallback);
    }
  }

  return assignments;
}

