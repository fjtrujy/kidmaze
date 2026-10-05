import './styles.css';
import { GameController } from './game/game-controller';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

const finalCelebration = requiredElement<HTMLElement>('final-celebration');
finalCelebration.classList.add('is-hidden');

new GameController({
  mazeBoard: requiredElement('maze-board'),
  levelProgress: requiredElement('level-progress'),
  drawingCanvas: requiredElement<HTMLCanvasElement>('drawing-canvas'),
  clearButton: requiredElement<HTMLButtonElement>('clear-button'),
  soundButton: requiredElement<HTMLButtonElement>('sound-button'),
  soundIcon: requiredElement('sound-icon'),
  commandFeedback: requiredElement('command-feedback'),
  feedbackArrow: requiredElement('feedback-arrow'),
  feedbackWord: requiredElement('feedback-word'),
  finalCelebration,
  restartButton: requiredElement<HTMLButtonElement>('restart-button'),
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

