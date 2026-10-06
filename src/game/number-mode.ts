import { createChoiceAssignments } from './letter-mode';
import type { ParsedMazeLevel } from './types';

export const NUMBER_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export type NumberDigit = (typeof NUMBER_DIGITS)[number];

export function createNumberAssignments(
  level: ParsedMazeLevel,
  random: () => number = Math.random,
): ReadonlyMap<string, NumberDigit> {
  return createChoiceAssignments(level, NUMBER_DIGITS, random);
}
