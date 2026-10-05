import type { Direction, MazeLevelDefinition, ParsedMazeLevel, Position } from './types';

const DIRECTION_DELTA: Record<Direction, Position> = {
  UP: { row: -1, col: 0 },
  DOWN: { row: 1, col: 0 },
  LEFT: { row: 0, col: -1 },
  RIGHT: { row: 0, col: 1 },
};

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function parseLevel(definition: MazeLevelDefinition): ParsedMazeLevel {
  const rows = definition.grid.length;
  const cols = definition.grid[0]?.length ?? 0;

  if (rows === 0 || cols === 0) {
    throw new Error(`Level "${definition.name}" must contain at least one cell.`);
  }

  let start: Position | undefined;
  let exit: Position | undefined;
  const walkable: boolean[][] = [];

  definition.grid.forEach((row, rowIndex) => {
    if (row.length !== cols) {
      throw new Error(`Level "${definition.name}" must be rectangular.`);
    }

    const parsedRow: boolean[] = [];
    [...row].forEach((cell, colIndex) => {
      if (!['#', '.', 'S', 'E'].includes(cell)) {
        throw new Error(`Level "${definition.name}" contains an unsupported cell: ${cell}`);
      }

      parsedRow.push(cell !== '#');

      if (cell === 'S') {
        if (start) {
          throw new Error(`Level "${definition.name}" has more than one start cell.`);
        }
        start = { row: rowIndex, col: colIndex };
      }

      if (cell === 'E') {
        if (exit) {
          throw new Error(`Level "${definition.name}" has more than one exit cell.`);
        }
        exit = { row: rowIndex, col: colIndex };
      }
    });
    walkable.push(parsedRow);
  });

  if (!start || !exit) {
    throw new Error(`Level "${definition.name}" must have exactly one start and one exit.`);
  }

  return { name: definition.name, rows, cols, walkable, start, exit };
}

export class Maze {
  readonly level: ParsedMazeLevel;
  private currentPosition: Position;

  constructor(definition: MazeLevelDefinition) {
    this.level = parseLevel(definition);
    this.currentPosition = { ...this.level.start };
  }

  get position(): Position {
    return { ...this.currentPosition };
  }

  get isComplete(): boolean {
    return samePosition(this.currentPosition, this.level.exit);
  }

  reset(): void {
    this.currentPosition = { ...this.level.start };
  }

  moveUntilBlocked(direction: Direction): Position[] {
    const delta = DIRECTION_DELTA[direction];
    const path: Position[] = [];
    let cursor = { ...this.currentPosition };

    while (true) {
      const next = { row: cursor.row + delta.row, col: cursor.col + delta.col };
      if (!this.isWalkable(next)) {
        break;
      }

      path.push(next);
      cursor = next;

      if (samePosition(cursor, this.level.exit)) {
        break;
      }
    }

    return path;
  }

  setPosition(position: Position): void {
    if (!this.isWalkable(position)) {
      throw new Error('Cannot move the player onto a blocked cell.');
    }
    this.currentPosition = { ...position };
  }

  private isWalkable(position: Position): boolean {
    if (
      position.row < 0 ||
      position.row >= this.level.rows ||
      position.col < 0 ||
      position.col >= this.level.cols
    ) {
      return false;
    }

    return this.level.walkable[position.row]?.[position.col] === true;
  }
}

