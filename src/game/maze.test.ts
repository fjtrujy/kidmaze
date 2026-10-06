import { describe, expect, it } from 'vitest';
import { LEVELS, LEVELS_PER_ROUND } from './levels';
import { Maze, parseLevel } from './maze';
import type { Direction } from './types';

const SOLUTIONS: readonly (readonly Direction[])[] = [
  ['RIGHT', 'DOWN'],
  ['DOWN', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN'],
  ['RIGHT', 'UP', 'LEFT', 'UP', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'DOWN'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'DOWN', 'LEFT'],
  ['UP', 'RIGHT', 'DOWN', 'RIGHT', 'UP', 'RIGHT', 'DOWN', 'LEFT'],
  ['RIGHT', 'DOWN', 'RIGHT', 'DOWN', 'LEFT', 'DOWN', 'LEFT', 'DOWN'],
  ['UP', 'RIGHT', 'UP', 'LEFT', 'UP', 'RIGHT', 'DOWN', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'DOWN', 'LEFT', 'DOWN'],
  ['LEFT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'DOWN', 'RIGHT', 'UP', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'UP', 'RIGHT', 'DOWN', 'LEFT', 'DOWN'],
];

describe('Maze', () => {
  it('ships two seven-level rounds with a harder second round', () => {
    expect(LEVELS).toHaveLength(LEVELS_PER_ROUND * 2);
    const firstRoundLongestSolution = Math.max(...SOLUTIONS.slice(0, LEVELS_PER_ROUND).map((solution) => solution.length));
    const secondRoundShortestSolution = Math.min(...SOLUTIONS.slice(LEVELS_PER_ROUND).map((solution) => solution.length));
    expect(secondRoundShortestSolution).toBeGreaterThan(firstRoundLongestSolution);

    const walkableCount = (index: number): number =>
      parseLevel(LEVELS[index]).walkable.flat().filter(Boolean).length;
    const firstRoundLongestTrail = Math.max(...LEVELS.slice(0, LEVELS_PER_ROUND).map((_, index) => walkableCount(index)));
    const secondRoundShortestTrail = Math.min(
      ...LEVELS.slice(LEVELS_PER_ROUND).map((_, index) => walkableCount(index + LEVELS_PER_ROUND)),
    );
    expect(secondRoundShortestTrail).toBeGreaterThan(firstRoundLongestTrail);
  });

  it('keeps the player in place when a wall is immediately ahead', () => {
    const maze = new Maze(LEVELS[0]);
    expect(maze.moveUntilBlocked('UP')).toEqual([]);
    expect(maze.position).toEqual(maze.level.start);
  });

  it.each(LEVELS.map((level, index) => [level.name, index] as const))(
    'has a known solution for %s',
    (_name, index) => {
      const maze = new Maze(LEVELS[index]);
      for (const direction of SOLUTIONS[index] ?? []) {
        const path = maze.moveUntilBlocked(direction);
        for (const position of path) {
          maze.setPosition(position);
        }
      }
      expect(maze.isComplete).toBe(true);
    },
  );
});

