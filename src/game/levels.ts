import type { MazeLevelDefinition } from './types';

export const LEVELS: readonly MazeLevelDefinition[] = [
  {
    name: 'Warm Up',
    grid: ['######', '#S...#', '####.#', '####.#', '####E#', '######'],
  },
  {
    name: 'Down and Across',
    grid: ['######', '#S####', '#.####', '#.####', '#...E#', '######'],
  },
  {
    name: 'Three Turns',
    grid: ['######', '#S...#', '####.#', '##E..#', '######', '######'],
  },
  {
    name: 'Little Zigzag',
    grid: ['######', '#S...#', '####.#', '#....#', '#.####', '#E####'],
  },
  {
    name: 'Long Way Home',
    grid: ['#######', '#...E##', '#.#####', '#....##', '####.##', '#S...##', '#######'],
  },
  {
    name: 'Big Sweep',
    grid: ['########', '#S....##', '#####.##', '#.....##', '#.######', '#.....E#', '########', '########'],
  },
  {
    name: 'Final Trail',
    grid: ['########', '#S....##', '#####.##', '##....##', '##.#####', '##....##', '#####E##', '########'],
  },
] as const;

