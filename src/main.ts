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

const brandButton = requiredElement<HTMLButtonElement>('brand-button');
const versionToast = requiredElement<HTMLElement>('version-toast');
let versionToastTimer: number | null = null;

brandButton.addEventListener('click', () => {
  if (versionToastTimer !== null) {
    window.clearTimeout(versionToastTimer);
  }

  versionToast.textContent = `v${__APP_VERSION__}`;
  versionToast.classList.add('is-visible');
  versionToast.setAttribute('aria-hidden', 'false');
  versionToastTimer = window.setTimeout(() => {
    versionToast.classList.remove('is-visible');
    versionToast.setAttribute('aria-hidden', 'true');
    versionToastTimer = null;
  }, 2200);
});

new GameController({
  mazeBoard: requiredElement('maze-board'),
  levelProgress: requiredElement('level-progress'),
  languageSelector: requiredElement('language-selector'),
  languageEnButton: requiredElement<HTMLButtonElement>('language-en'),
  languageEsButton: requiredElement<HTMLButtonElement>('language-es'),
  modeSelector: requiredElement('mode-selector'),
  modeArrowsButton: requiredElement<HTMLButtonElement>('mode-arrows'),
  modeLettersButton: requiredElement<HTMLButtonElement>('mode-letters'),
  drawingHint: requiredElement('drawing-hint'),
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

// The game deliberately has no scrollable UI. Prevent the browser from
// interpreting pen/finger drags as viewport panning, pull-to-refresh, or
// pinch gestures, which can otherwise interrupt drawing or exit full screen.
const preventViewportGesture = (event: Event): void => {
  if (event.cancelable) {
    event.preventDefault();
  }
};

document.addEventListener('touchmove', preventViewportGesture, { passive: false });
document.addEventListener('gesturestart', preventViewportGesture, { passive: false });
document.addEventListener('gesturechange', preventViewportGesture, { passive: false });

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

