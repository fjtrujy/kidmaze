import { LETTER_ALPHABET, type Letter } from './letter-mode';
import { createSymbolRecognizer, type ShapeTemplate } from './symbol-recognizer';
import type { Drawing } from './types';

export interface LetterRecognitionResult {
  letter: Letter | 'UNKNOWN';
  confidence: number;
}

type LetterTemplate = ShapeTemplate;

const LETTER_TEMPLATES: Record<Letter, readonly LetterTemplate[]> = {
  A: [
    [
      [[0.12, 1], [0.5, 0]],
      [[0.5, 0], [0.88, 1]],
      [[0.28, 0.58], [0.72, 0.58]],
    ],
  ],
  B: [
    [[
      [0.16, 0], [0.16, 1], [0.16, 0],
      [0.56, 0], [0.84, 0.12], [0.84, 0.38], [0.56, 0.5], [0.16, 0.5],
      [0.58, 0.5], [0.9, 0.62], [0.9, 0.88], [0.58, 1], [0.16, 1],
    ]],
    [
      [[0.16, 0], [0.16, 1]],
      [[0.16, 0], [0.58, 0], [0.86, 0.12], [0.86, 0.38], [0.58, 0.5], [0.16, 0.5]],
      [[0.16, 0.5], [0.6, 0.5], [0.9, 0.62], [0.9, 0.88], [0.6, 1], [0.16, 1]],
    ],
  ],
  E: [
    [[
      [0.82, 0.04], [0.18, 0.04], [0.18, 0.96], [0.84, 0.96],
      [0.18, 0.96], [0.18, 0.5], [0.7, 0.5],
    ]],
    [
      [[0.18, 0], [0.18, 1]],
      [[0.18, 0], [0.86, 0]],
      [[0.18, 0.5], [0.72, 0.5]],
      [[0.18, 1], [0.86, 1]],
    ],
  ],
  I: [
    [[[0.5, 0], [0.5, 1]]],
    [
      [[0.18, 0], [0.82, 0]],
      [[0.5, 0], [0.5, 1]],
      [[0.18, 1], [0.82, 1]],
    ],
  ],
  L: [
    [[[0.22, 0], [0.22, 1], [0.88, 1]]],
    [
      [[0.22, 0], [0.22, 1]],
      [[0.22, 1], [0.88, 1]],
    ],
  ],
  M: [
    [[
      [0.12, 1], [0.12, 0], [0.5, 0.56], [0.88, 0], [0.88, 1],
    ]],
    [
      [[0.12, 1], [0.12, 0]],
      [[0.12, 0], [0.5, 0.56]],
      [[0.5, 0.56], [0.88, 0]],
      [[0.88, 0], [0.88, 1]],
    ],
  ],
  O: [
    [[
      [0.5, 0], [0.2, 0.08], [0.04, 0.32], [0.04, 0.68], [0.2, 0.92], [0.5, 1],
      [0.8, 0.92], [0.96, 0.68], [0.96, 0.32], [0.8, 0.08], [0.5, 0],
    ]],
  ],
  T: [
    [
      [[0.08, 0.08], [0.92, 0.08]],
      [[0.5, 0.08], [0.5, 1]],
    ],
  ],
  X: [
    [
      [[0.08, 0.04], [0.92, 0.96]],
      [[0.92, 0.04], [0.08, 0.96]],
    ],
  ],
};

const recognizeLetter = createSymbolRecognizer(LETTER_ALPHABET, LETTER_TEMPLATES);

export class LetterRecognizer {
  recognize(drawing: Drawing): LetterRecognitionResult {
    const result = recognizeLetter(drawing);
    return { letter: result.value, confidence: result.confidence };
  }
}

