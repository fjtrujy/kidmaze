import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { Maze } from './maze';
import type { Direction } from './types';

const SOLUTIONS: readonly (readonly Direction[])[] = [
  ['RIGHT', 'DOWN'],
  ['DOWN', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN'],
  ['RIGHT', 'UP', 'LEFT', 'UP', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT'],
  ['RIGHT', 'DOWN', 'LEFT', 'DOWN', 'RIGHT', 'DOWN'],
];

describe('Maze', () => {
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

