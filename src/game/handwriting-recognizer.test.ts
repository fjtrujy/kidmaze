import { describe, expect, it } from 'vitest';
import { rasterizeDrawingForModel, selectHandwritingCandidate } from './handwriting-recognizer';
import { LETTER_ALPHABET } from './letter-mode';
import { NUMBER_DIGITS } from './number-mode';
import modelConfig from './symbol-model-config.json';
import type { Drawing } from './types';

const emptyLogits = (): number[] => Array.from({ length: modelConfig.labels.length }, () => 0);

describe('handwriting recognizer helpers', () => {
  it('keeps the model labels synchronized with every game symbol', () => {
    expect(modelConfig.labels).toEqual([...NUMBER_DIGITS, ...LETTER_ALPHABET]);
  });

  it('selects only among currently reachable numeric choices', () => {
    const logits = emptyLogits();
    logits[3] = 4.5;
    logits[7] = 7;
    logits[8] = 1;

    const result = selectHandwritingCandidate(logits, ['3', '8']);
    expect(result.value).toBe('3');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('rejects an ambiguous pair instead of guessing', () => {
    const logits = emptyLogits();
    logits[10] = 3;
    logits[11] = 3;

    expect(selectHandwritingCandidate(logits, ['A', 'B']).value).toBe('UNKNOWN');
  });

  it('keeps digit and letter classes isolated', () => {
    const logits = emptyLogits();
    logits[0] = 3;
    logits[16] = 12;

    expect(selectHandwritingCandidate(logits, ['0']).value).toBe('0');
  });

  it('supports letters across the complete alphabet', () => {
    const logits = emptyLogits();
    const zIndex = modelConfig.labels.indexOf('Z');
    logits[zIndex] = 8;

    expect(selectHandwritingCandidate(logits, ['M', 'Z']).value).toBe('Z');
  });

  it('rasterizes multi-stroke drawings into normalized 28x28 model input', () => {
    const drawing: Drawing = [
      [{ x: 10, y: 90 }, { x: 50, y: 10 }],
      [{ x: 50, y: 10 }, { x: 90, y: 90 }],
      [{ x: 30, y: 55 }, { x: 70, y: 55 }],
    ];
    const image = rasterizeDrawingForModel(drawing);

    expect(image).not.toBeNull();
    expect(image).toHaveLength(28 * 28);
    expect(Array.from(image ?? []).every(Number.isFinite)).toBe(true);
    expect(Math.max(...(image ?? []))).toBeGreaterThan(1);
  });

  it('rejects tiny accidental marks before inference', () => {
    expect(rasterizeDrawingForModel([[{ x: 10, y: 10 }, { x: 12, y: 11 }]])).toBeNull();
  });
});
