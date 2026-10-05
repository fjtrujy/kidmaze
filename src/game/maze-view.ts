import type { Direction, ParsedMazeLevel, Position } from './types';
import { translation, type Language } from './i18n';

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class MazeView {
  private readonly board: HTMLElement;
  private player: HTMLElement | null = null;
  private exit: HTMLElement | null = null;
  private rows = 1;
  private cols = 1;
  private language: Language = 'en';

  constructor(board: HTMLElement) {
    this.board = board;
  }

  render(level: ParsedMazeLevel, playerPosition: Position): void {
    this.rows = level.rows;
    this.cols = level.cols;
    this.board.replaceChildren();
    this.exit = null;
    this.board.style.setProperty('--maze-rows', String(level.rows));
    this.board.style.setProperty('--maze-cols', String(level.cols));
    this.board.style.aspectRatio = `${level.cols} / ${level.rows}`;

    for (let row = 0; row < level.rows; row += 1) {
      for (let col = 0; col < level.cols; col += 1) {
        const cell = document.createElement('div');
        const position = { row, col };
        cell.className = level.walkable[row]?.[col] ? 'maze-cell floor-cell' : 'maze-cell wall-cell';

        if (samePosition(position, level.exit)) {
          cell.classList.add('exit-cell');
          const exit = document.createElement('span');
          exit.className = 'exit-bandage';
          exit.textContent = '🩹';
          this.exit = exit;
          cell.append(exit);
        }

        this.board.append(cell);
      }
    }

    this.player = document.createElement('div');
    this.player.className = 'nurse';
    this.player.textContent = '👩‍⚕️';
    this.board.append(this.player);
    this.updateAccessibleLabels();
    this.setPlayerPosition(playerPosition, false);
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.updateAccessibleLabels();
  }

  setPlayerPosition(position: Position, animated = true): void {
    if (!this.player) {
      return;
    }

    this.player.classList.toggle('is-moving', animated);
    this.player.style.width = `${100 / this.cols}%`;
    this.player.style.height = `${100 / this.rows}%`;
    this.player.style.left = `${(position.col / this.cols) * 100}%`;
    this.player.style.top = `${(position.row / this.rows) * 100}%`;
  }

  async bump(direction: Direction): Promise<void> {
    if (!this.player) {
      return;
    }

    const className = `bump-${direction.toLowerCase()}`;
    this.player.classList.add(className);
    await wait(320);
    this.player.classList.remove(className);
  }

  async celebrate(): Promise<void> {
    if (!this.player) {
      return;
    }
    this.player.classList.add('is-celebrating');
    await wait(720);
    this.player.classList.remove('is-celebrating');
  }

  private updateAccessibleLabels(): void {
    const text = translation(this.language);
    this.player?.setAttribute('aria-label', text.nurse);
    this.exit?.setAttribute('aria-label', text.bandageDestination);
  }
}

