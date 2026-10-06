export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameMode = 'ARROWS' | 'LETTERS' | 'NUMBERS';

export interface Point {
  x: number;
  y: number;
}

export type Stroke = readonly Point[];

export type Drawing = readonly Stroke[];

export interface Position {
  row: number;
  col: number;
}

export interface MazeLevelDefinition {
  name: string;
  grid: readonly string[];
}

export interface ParsedMazeLevel {
  name: string;
  rows: number;
  cols: number;
  walkable: boolean[][];
  start: Position;
  exit: Position;
}

export interface RecognitionResult {
  direction: Direction | 'UNKNOWN';
  confidence: number;
}

