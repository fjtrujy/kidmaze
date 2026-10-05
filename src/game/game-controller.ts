import { DrawingCanvas } from './drawing-canvas';
import { LEVELS } from './levels';
import { Maze } from './maze';
import { MazeView } from './maze-view';
import { SoundController } from './sound';
import { StrokeRecognizer } from './stroke-recognizer';
import type { Direction, Drawing } from './types';

const DIRECTION_SYMBOL: Record<Direction, string> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
};

const STEP_DURATION_MS = 185;
const FEEDBACK_DURATION_MS = 560;

interface GameElements {
  mazeBoard: HTMLElement;
  levelProgress: HTMLElement;
  drawingCanvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
  soundButton: HTMLButtonElement;
  soundIcon: HTMLElement;
  commandFeedback: HTMLElement;
  feedbackArrow: HTMLElement;
  feedbackWord: HTMLElement;
  finalCelebration: HTMLElement;
  restartButton: HTMLButtonElement;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class GameController {
  private readonly elements: GameElements;
  private readonly recognizer = new StrokeRecognizer();
  private readonly mazeView: MazeView;
  private readonly drawingCanvas: DrawingCanvas;
  private readonly sound = new SoundController();
  private maze: Maze;
  private levelIndex = 0;
  private busy = false;

  constructor(elements: GameElements) {
    this.elements = elements;
    this.maze = new Maze(LEVELS[0]);
    this.mazeView = new MazeView(elements.mazeBoard);
    this.drawingCanvas = new DrawingCanvas(elements.drawingCanvas, (drawing) => {
      void this.handleDrawing(drawing);
    });

    elements.clearButton.addEventListener('click', () => this.drawingCanvas.clear());
    elements.soundButton.addEventListener('click', () => this.toggleSound());
    elements.restartButton.addEventListener('click', () => this.restart());
    window.addEventListener('keydown', this.handleKeyDown);

    this.loadLevel(0);
  }

  private loadLevel(index: number): void {
    this.levelIndex = index;
    this.maze = new Maze(LEVELS[index]);
    this.mazeView.render(this.maze.level, this.maze.position);
    this.renderProgress();
    this.drawingCanvas.clear();
    this.setBusy(false);
  }

  private readonly handleDrawing = async (drawing: Drawing): Promise<void> => {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    const result = this.recognizer.recognize(drawing);
    this.drawingCanvas.clear();

    if (result.direction === 'UNKNOWN') {
      await this.showFeedback('?', '');
      this.setBusy(false);
      return;
    }

    this.sound.playRecognized();
    await this.showFeedback(DIRECTION_SYMBOL[result.direction], result.direction);
    await this.executeDirection(result.direction);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const directions: Partial<Record<string, Direction>> = {
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
    };
    const direction = directions[event.key];
    if (!direction || this.busy || !this.elements.finalCelebration.classList.contains('is-hidden')) {
      return;
    }

    event.preventDefault();
    void this.runDebugDirection(direction);
  };

  private async runDebugDirection(direction: Direction): Promise<void> {
    this.setBusy(true);
    this.sound.playRecognized();
    await this.showFeedback(DIRECTION_SYMBOL[direction], direction);
    await this.executeDirection(direction);
  }

  private async executeDirection(direction: Direction): Promise<void> {
    const path = this.maze.moveUntilBlocked(direction);

    if (path.length === 0) {
      this.sound.playBump();
      await this.mazeView.bump(direction);
      this.setBusy(false);
      return;
    }

    for (const position of path) {
      this.maze.setPosition(position);
      this.mazeView.setPlayerPosition(position);
      await wait(STEP_DURATION_MS);

      if (this.maze.isComplete) {
        await this.completeLevel();
        return;
      }
    }

    this.setBusy(false);
  }

  private async completeLevel(): Promise<void> {
    this.sound.playSuccess();
    this.launchConfetti();
    await this.mazeView.celebrate();
    await wait(520);

    const nextLevel = this.levelIndex + 1;
    if (nextLevel < LEVELS.length) {
      this.loadLevel(nextLevel);
      return;
    }

    this.showFinalCelebration();
  }

  private async showFeedback(symbol: string, word: string): Promise<void> {
    this.elements.feedbackArrow.textContent = symbol;
    this.elements.feedbackWord.textContent = word;
    this.elements.feedbackWord.classList.toggle('is-empty', word.length === 0);
    this.elements.commandFeedback.setAttribute('aria-hidden', 'false');
    this.elements.commandFeedback.classList.add('is-visible');
    await wait(FEEDBACK_DURATION_MS);
    this.elements.commandFeedback.classList.remove('is-visible');
    this.elements.commandFeedback.setAttribute('aria-hidden', 'true');
    await wait(90);
  }

  private renderProgress(): void {
    this.elements.levelProgress.replaceChildren();
    LEVELS.forEach((_, index) => {
      const dot = document.createElement('span');
      dot.className = 'level-dot';
      if (index < this.levelIndex) {
        dot.classList.add('is-complete');
      } else if (index === this.levelIndex) {
        dot.classList.add('is-current');
      }
      dot.setAttribute('aria-hidden', 'true');
      this.elements.levelProgress.append(dot);
    });
    this.elements.levelProgress.setAttribute(
      'aria-label',
      `Level ${this.levelIndex + 1} of ${LEVELS.length}`,
    );
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.drawingCanvas.setEnabled(!busy);
    this.elements.clearButton.disabled = busy;
  }

  private toggleSound(): void {
    const muted = this.sound.toggleMuted();
    this.elements.soundIcon.textContent = muted ? '🔇' : '🔊';
    this.elements.soundButton.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
  }

  private showFinalCelebration(): void {
    this.elements.finalCelebration.classList.remove('is-hidden');
    this.elements.finalCelebration.setAttribute('aria-hidden', 'false');
    this.launchConfetti(34);
  }

  private restart(): void {
    this.elements.finalCelebration.classList.add('is-hidden');
    this.elements.finalCelebration.setAttribute('aria-hidden', 'true');
    this.loadLevel(0);
  }

  private launchConfetti(count = 22): void {
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    layer.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.textContent = index % 4 === 0 ? '★' : '●';
      piece.style.setProperty('--confetti-x', `${5 + Math.random() * 90}vw`);
      piece.style.setProperty('--confetti-delay', `${Math.random() * 0.28}s`);
      piece.style.setProperty('--confetti-turn', `${Math.round(Math.random() * 540 - 270)}deg`);
      piece.style.setProperty('--confetti-hue', `${Math.round(Math.random() * 300)}deg`);
      layer.append(piece);
    }

    document.body.append(layer);
    window.setTimeout(() => layer.remove(), 1800);
  }
}

