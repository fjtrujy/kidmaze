import type { Direction } from './types';

export type Language = 'en' | 'es';

interface TranslationSet {
  directions: Record<Direction, string>;
  levelProgress: (current: number, total: number) => string;
  languageSelector: string;
  english: string;
  spanish: string;
  maze: string;
  drawingArea: string;
  drawArrow: string;
  drawLetter: string;
  drawNumber: string;
  gameMode: string;
  arrowMode: string;
  letterMode: string;
  numberMode: string;
  clearDrawing: string;
  muteSound: string;
  turnSoundOn: string;
  enterFullscreen: string;
  exitFullscreen: string;
  installForFullscreen: string;
  installFullscreenInstructions: string;
  playAgain: string;
  nurse: string;
  bandageDestination: string;
}

const TRANSLATIONS: Record<Language, TranslationSet> = {
  en: {
    directions: {
      UP: 'UP',
      DOWN: 'DOWN',
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
    },
    levelProgress: (current, total) => `Level ${current} of ${total}`,
    languageSelector: 'Language',
    english: 'English',
    spanish: 'Spanish',
    maze: 'Maze',
    drawingArea: 'Drawing area',
    drawArrow: 'Draw an arrow here',
    drawLetter: 'Draw the visible letter here',
    drawNumber: 'Draw the visible number here',
    gameMode: 'Game mode',
    arrowMode: 'Arrow mode',
    letterMode: 'Letter mode',
    numberMode: 'Number mode',
    clearDrawing: 'Clear drawing',
    muteSound: 'Mute sound',
    turnSoundOn: 'Turn sound on',
    enterFullscreen: 'Enter full screen',
    exitFullscreen: 'Exit full screen',
    installForFullscreen: 'Open as app for full screen',
    installFullscreenInstructions:
      'On iPad, Safari reserves downward swipes for leaving full screen. For reliable drawing, tap Share, choose Add to Home Screen, and open Kid Maze from its Home Screen icon.',
    playAgain: 'Play again',
    nurse: 'Nurse',
    bandageDestination: 'Bandage destination',
  },
  es: {
    directions: {
      UP: 'ARRIBA',
      DOWN: 'ABAJO',
      LEFT: 'IZQUIERDA',
      RIGHT: 'DERECHA',
    },
    levelProgress: (current, total) => `Nivel ${current} de ${total}`,
    languageSelector: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    maze: 'Laberinto',
    drawingArea: 'Zona de dibujo',
    drawArrow: 'Dibuja una flecha aquí',
    drawLetter: 'Dibuja aquí la letra visible',
    drawNumber: 'Dibuja aquí el número visible',
    gameMode: 'Modo de juego',
    arrowMode: 'Modo flechas',
    letterMode: 'Modo letras',
    numberMode: 'Modo números',
    clearDrawing: 'Borrar dibujo',
    muteSound: 'Silenciar sonido',
    turnSoundOn: 'Activar sonido',
    enterFullscreen: 'Pantalla completa',
    exitFullscreen: 'Salir de pantalla completa',
    installForFullscreen: 'Abrir como app a pantalla completa',
    installFullscreenInstructions:
      'En iPad, Safari reserva los gestos hacia abajo para salir de pantalla completa. Para dibujar sin interrupciones, pulsa Compartir, elige Añadir a pantalla de inicio y abre Kid Maze desde su icono.',
    playAgain: 'Jugar otra vez',
    nurse: 'Enfermera',
    bandageDestination: 'Destino: tirita',
  },
};

export function translation(language: Language): TranslationSet {
  return TRANSLATIONS[language];
}

export function initialLanguage(): Language {
  const saved = window.localStorage.getItem('kidmaze-language');
  if (saved === 'en' || saved === 'es') {
    return saved;
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}
