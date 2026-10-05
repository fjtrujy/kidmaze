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
  clearDrawing: string;
  muteSound: string;
  turnSoundOn: string;
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
    clearDrawing: 'Clear drawing',
    muteSound: 'Mute sound',
    turnSoundOn: 'Turn sound on',
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
    clearDrawing: 'Borrar dibujo',
    muteSound: 'Silenciar sonido',
    turnSoundOn: 'Activar sonido',
    playAgain: 'Jugar otra vez',
    nurse: 'Enfermera',
    bandageDestination: 'Destino: tirita',
  },
};

export function translation(language: Language): TranslationSet {
  return TRANSLATIONS[language];
}

export function speechLocale(language: Language): string {
  return language === 'es' ? 'es-ES' : 'en-GB';
}

export function initialLanguage(): Language {
  const saved = window.localStorage.getItem('kidmaze-language');
  if (saved === 'en' || saved === 'es') {
    return saved;
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}
