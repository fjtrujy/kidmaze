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
  languageSelector: requiredElement('language-selector'),
  languageEnButton: requiredElement<HTMLButtonElement>('language-en'),
  languageEsButton: requiredElement<HTMLButtonElement>('language-es'),
  drawingCanvas: requiredElement<HTMLCanvasElement>('drawing-canvas'),
  drawingScanner: requiredElement('drawing-scanner'),
  clearButton: requiredElement<HTMLButtonElement>('clear-button'),
  soundButton: requiredElement<HTMLButtonElement>('sound-button'),
  soundIcon: requiredElement('sound-icon'),
  fullscreenButton: requiredElement<HTMLButtonElement>('fullscreen-button'),
  commandFeedback: requiredElement('command-feedback'),
  feedbackArrow: requiredElement('feedback-arrow'),
  feedbackWord: requiredElement('feedback-word'),
  finalCelebration,
  restartButton: requiredElement<HTMLButtonElement>('restart-button'),
});

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalHost) {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ('caches' in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(
            cacheNames.filter((name) => name.startsWith('kidmaze-')).map((name) => window.caches.delete(name)),
          );
        }
      });
      return;
    }

    if (import.meta.env.PROD) {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    }
  });
}

