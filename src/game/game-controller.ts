import { DrawingCanvas } from './drawing-canvas';
import { initialLanguage, translation, type Language } from './i18n';
import { createLetterAssignments, LETTER_ALPHABET, positionKey, walkableNeighbors, type Letter } from './letter-mode';
import { LetterRecognizer } from './letter-recognizer';
import { LEVELS } from './levels';
import { Maze } from './maze';
import { MazeView } from './maze-view';
import { SoundController } from './sound';
import { StrokeRecognizer } from './stroke-recognizer';
import type { Direction, Drawing, GameMode } from './types';

const DIRECTION_SYMBOL: Record<Direction, string> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
};

const STEP_DURATION_MS = 185;
const FEEDBACK_DURATION_MS = 560;
const BLOCKED_MESSAGE_DELAY_MS = 250;
const MAX_DIRECTION_SPEECH_WAIT_MS = 1500;

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

interface GameElements {
  mazeBoard: HTMLElement;
  levelProgress: HTMLElement;
  languageSelector: HTMLElement;
  languageEnButton: HTMLButtonElement;
  languageEsButton: HTMLButtonElement;
  modeSelector: HTMLElement;
  modeArrowsButton: HTMLButtonElement;
  modeLettersButton: HTMLButtonElement;
  drawingHint: HTMLElement;
  drawingCanvas: HTMLCanvasElement;
  drawingScanner: HTMLElement;
  clearButton: HTMLButtonElement;
  soundButton: HTMLButtonElement;
  soundIcon: HTMLElement;
  fullscreenButton: HTMLButtonElement;
  commandFeedback: HTMLElement;
  feedbackArrow: HTMLElement;
  feedbackWord: HTMLElement;
  finalCelebration: HTMLElement;
  restartButton: HTMLButtonElement;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isAppleTouchDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneWebApp(): boolean {
  const appleNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || appleNavigator.standalone === true;
}

function initialGameMode(): GameMode {
  return window.localStorage.getItem('kidmaze-mode') === 'LETTERS' ? 'LETTERS' : 'ARROWS';
}

export class GameController {
  private readonly elements: GameElements;
  private readonly recognizer = new StrokeRecognizer();
  private readonly letterRecognizer = new LetterRecognizer();
  private readonly mazeView: MazeView;
  private readonly drawingCanvas: DrawingCanvas;
  private readonly sound = new SoundController();
  private maze: Maze;
  private levelIndex = 0;
  private busy = false;
  private language: Language = initialLanguage();
  private mode: GameMode = initialGameMode();
  private letterAssignments: ReadonlyMap<string, Letter> = new Map();

  constructor(elements: GameElements) {
    this.elements = elements;
    this.maze = new Maze(LEVELS[0]);
    this.mazeView = new MazeView(elements.mazeBoard);
    this.drawingCanvas = new DrawingCanvas(elements.drawingCanvas, elements.drawingScanner, (drawing) => {
      void this.handleDrawing(drawing);
    });

    elements.clearButton.addEventListener('click', () => this.drawingCanvas.clear());
    elements.soundButton.addEventListener('click', () => this.toggleSound());
    elements.fullscreenButton.addEventListener('click', () => void this.toggleFullscreen());
    elements.restartButton.addEventListener('click', () => this.restart());
    elements.languageEnButton.addEventListener('click', () => this.setLanguage('en'));
    elements.languageEsButton.addEventListener('click', () => this.setLanguage('es'));
    elements.modeArrowsButton.addEventListener('click', () => this.setMode('ARROWS'));
    elements.modeLettersButton.addEventListener('click', () => this.setMode('LETTERS'));
    document.addEventListener('fullscreenchange', this.updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', this.updateFullscreenButton);
    window.addEventListener('keydown', this.handleKeyDown);

    if (isStandaloneWebApp()) {
      elements.fullscreenButton.hidden = true;
    } else if (!this.fullscreenSupported() && !isAppleTouchDevice()) {
      elements.fullscreenButton.hidden = true;
    }

    this.applyLanguage();
    this.loadLevel(0);
  }

  private loadLevel(index: number): void {
    this.levelIndex = index;
    this.maze = new Maze(LEVELS[index]);
    this.letterAssignments = createLetterAssignments(this.maze.level);
    this.mazeView.render(this.maze.level, this.maze.position);
    this.updateLetterHints();
    this.renderProgress();
    this.drawingCanvas.clear();
    this.setBusy(false);
  }

  private readonly handleDrawing = async (drawing: Drawing): Promise<void> => {
    if (this.busy) {
      return;
    }

    this.setBusy(true);
    try {
      this.drawingCanvas.clear();

      if (this.mode === 'LETTERS') {
        await this.handleLetterDrawing(drawing);
        return;
      }

      const result = this.recognizer.recognize(drawing);

      if (result.direction === 'UNKNOWN') {
        await this.showFeedback('?', '');
        this.setBusy(false);
        return;
      }

      this.sound.playRecognized();
      const word = translation(this.language).directions[result.direction];
      const directionSpeech = this.sound.playDirection(result.direction, this.language);
      await this.showFeedback(DIRECTION_SYMBOL[result.direction], word);
      await this.executeDirection(result.direction, directionSpeech);
    } catch (error) {
      console.error('Unable to process drawing.', error);
      this.setBusy(false);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.busy || !this.elements.finalCelebration.classList.contains('is-hidden')) {
      return;
    }

    if (this.mode === 'LETTERS') {
      const letter = event.key.toUpperCase() as Letter;
      if (!LETTER_ALPHABET.includes(letter)) {
        return;
      }
      event.preventDefault();
      void this.runDebugLetter(letter);
      return;
    }

    const directions: Partial<Record<string, Direction>> = {
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
    };
    const direction = directions[event.key];
    if (!direction) {
      return;
    }

    event.preventDefault();
    void this.runDebugDirection(direction);
  };

  private async runDebugDirection(direction: Direction): Promise<void> {
    this.setBusy(true);
    this.sound.playRecognized();
    const word = translation(this.language).directions[direction];
    const directionSpeech = this.sound.playDirection(direction, this.language);
    await this.showFeedback(DIRECTION_SYMBOL[direction], word);
    await this.executeDirection(direction, directionSpeech);
  }

  private async runDebugLetter(letter: Letter): Promise<void> {
    this.setBusy(true);
    this.sound.playRecognized();
    void this.sound.playLetter(letter, this.language);
    await this.showFeedback(letter, '');
    await this.executeLetter(letter);
  }

  private async handleLetterDrawing(drawing: Drawing): Promise<void> {
    const result = this.letterRecognizer.recognize(drawing);
    if (result.letter === 'UNKNOWN') {
      await this.showFeedback('?', '');
      this.setBusy(false);
      return;
    }

    this.sound.playRecognized();
    void this.sound.playLetter(result.letter, this.language);
    await this.showFeedback(result.letter, '');
    await this.executeLetter(result.letter);
  }

  private async executeLetter(letter: Letter): Promise<void> {
    const destination = walkableNeighbors(this.maze.level, this.maze.position).find(
      (position) => this.letterAssignments.get(positionKey(position)) === letter,
    );

    if (!destination) {
      this.setBusy(false);
      return;
    }

    this.maze.setPosition(destination);
    this.mazeView.setPlayerPosition(destination);
    await wait(STEP_DURATION_MS);
    this.updateLetterHints();

    if (this.maze.isComplete) {
      await this.completeLevel();
      return;
    }

    this.setBusy(false);
  }

  private async executeDirection(direction: Direction, directionSpeech: Promise<void>): Promise<void> {
    const path = this.maze.moveUntilBlocked(direction);

    if (path.length === 0) {
      await Promise.race([directionSpeech, wait(MAX_DIRECTION_SPEECH_WAIT_MS)]);
      await wait(BLOCKED_MESSAGE_DELAY_MS);
      this.sound.playBump(this.language);
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
      translation(this.language).levelProgress(this.levelIndex + 1, LEVELS.length),
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
    const text = translation(this.language);
    this.elements.soundButton.setAttribute('aria-label', muted ? text.turnSoundOn : text.muteSound);
  }

  private fullscreenSupported(): boolean {
    const root = document.documentElement as FullscreenElement;
    return typeof root.requestFullscreen === 'function' || typeof root.webkitRequestFullscreen === 'function';
  }

  private isFullscreen(): boolean {
    const fullscreenDocument = document as FullscreenDocument;
    return Boolean(document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement);
  }

  private async toggleFullscreen(): Promise<void> {
    if (isAppleTouchDevice() && !isStandaloneWebApp()) {
      window.alert(translation(this.language).installFullscreenInstructions);
      return;
    }

    const fullscreenDocument = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;

    try {
      if (this.isFullscreen()) {
        if (typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        } else {
          await fullscreenDocument.webkitExitFullscreen?.();
        }
      } else if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch (error) {
      console.warn('Unable to change full screen mode.', error);
    }
  }

  private readonly updateFullscreenButton = (): void => {
    const fullscreen = this.isFullscreen();
    const text = translation(this.language);

    if (isStandaloneWebApp()) {
      this.elements.fullscreenButton.hidden = true;
      return;
    }

    this.elements.fullscreenButton.hidden = false;
    this.elements.fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
    this.elements.fullscreenButton.setAttribute(
      'aria-label',
      isAppleTouchDevice()
        ? text.installForFullscreen
        : fullscreen
          ? text.exitFullscreen
          : text.enterFullscreen,
    );
  };

  private setLanguage(language: Language): void {
    if (this.language === language) {
      return;
    }
    this.language = language;
    window.localStorage.setItem('kidmaze-language', language);
    this.applyLanguage();
    this.renderProgress();
  }

  private setMode(mode: GameMode): void {
    if (this.mode === mode || this.busy) {
      return;
    }

    this.mode = mode;
    window.localStorage.setItem('kidmaze-mode', mode);
    this.elements.finalCelebration.classList.add('is-hidden');
    this.elements.finalCelebration.setAttribute('aria-hidden', 'true');
    this.applyModeUI();
    this.applyLanguage();
    this.loadLevel(this.levelIndex);
  }

  private applyModeUI(): void {
    const letterMode = this.mode === 'LETTERS';
    this.elements.modeArrowsButton.setAttribute('aria-pressed', String(!letterMode));
    this.elements.modeLettersButton.setAttribute('aria-pressed', String(letterMode));
    this.elements.drawingHint.classList.toggle('is-letter-mode', letterMode);
    const hints = letterMode ? LETTER_ALPHABET : ['↑', '↓', '←', '→'];
    this.elements.drawingHint.replaceChildren(
      ...hints.map((hint) => {
        const span = document.createElement('span');
        span.textContent = hint;
        return span;
      }),
    );
  }

  private updateLetterHints(): void {
    if (this.mode !== 'LETTERS') {
      this.mazeView.setLetterHints(null, []);
      return;
    }
    this.mazeView.setLetterHints(
      this.letterAssignments,
      walkableNeighbors(this.maze.level, this.maze.position),
    );
  }

  private applyLanguage(): void {
    const text = translation(this.language);
    document.documentElement.lang = this.language;
    this.elements.languageEnButton.setAttribute('aria-pressed', String(this.language === 'en'));
    this.elements.languageEsButton.setAttribute('aria-pressed', String(this.language === 'es'));
    this.elements.languageSelector.setAttribute('aria-label', text.languageSelector);
    this.elements.languageEnButton.setAttribute('aria-label', text.english);
    this.elements.languageEsButton.setAttribute('aria-label', text.spanish);
    this.elements.modeSelector.setAttribute('aria-label', text.gameMode);
    this.elements.modeArrowsButton.setAttribute('aria-label', text.arrowMode);
    this.elements.modeLettersButton.setAttribute('aria-label', text.letterMode);
    this.elements.drawingCanvas.setAttribute(
      'aria-label',
      this.mode === 'LETTERS' ? text.drawLetter : text.drawArrow,
    );
    this.elements.clearButton.setAttribute('aria-label', text.clearDrawing);
    this.elements.soundButton.setAttribute(
      'aria-label',
      this.sound.isMuted ? text.turnSoundOn : text.muteSound,
    );
    this.updateFullscreenButton();
    this.elements.restartButton.setAttribute('aria-label', text.playAgain);
    this.mazeView.setLanguage(this.language);
    this.applyModeUI();
  }

  private showFinalCelebration(): void {
    this.elements.finalCelebration.classList.remove('is-hidden');
    this.elements.finalCelebration.setAttribute('aria-hidden', 'false');
    this.sound.playApplause();
    this.launchConfetti(34);
    this.launchApplauseEmojis();
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

  private launchApplauseEmojis(count = 28): void {
    const layer = document.createElement('div');
    layer.className = 'applause-layer';
    layer.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'applause-piece';
      piece.textContent = '👏';
      piece.style.setProperty('--applause-x', `${3 + Math.random() * 94}vw`);
      piece.style.setProperty('--applause-delay', `${Math.random() * 0.65}s`);
      piece.style.setProperty('--applause-drift', `${Math.round(Math.random() * 100 - 50)}px`);
      piece.style.setProperty('--applause-turn', `${Math.round(Math.random() * 60 - 30)}deg`);
      piece.style.setProperty('--applause-size', `${0.8 + Math.random() * 0.7}`);
      layer.append(piece);
    }

    document.body.append(layer);
    window.setTimeout(() => layer.remove(), 3200);
  }
}

