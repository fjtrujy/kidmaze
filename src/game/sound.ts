import type { Language } from './i18n';
import { LETTER_ALPHABET, type Letter } from './letter-mode';
import type { Direction } from './types';

type LetterVoiceClip = `letter_${Lowercase<Letter>}`;
type VoiceClip = 'up' | 'down' | 'left' | 'right' | 'blocked' | LetterVoiceClip;

const VOICE_CLIPS: readonly VoiceClip[] = [
  'up',
  'down',
  'left',
  'right',
  'blocked',
  ...LETTER_ALPHABET.map((letter) => `letter_${letter.toLowerCase()}` as LetterVoiceClip),
];
const LANGUAGES: readonly Language[] = ['en', 'es'];

function voiceKey(language: Language, clip: VoiceClip): string {
  return `${language}:${clip}`;
}

function voiceUrl(language: Language, clip: VoiceClip): string {
  return `${import.meta.env.BASE_URL}audio/voice/${language}/${clip}.wav`;
}

export class SoundController {
  private context: AudioContext | null = null;
  private muted = false;
  private readonly voiceBuffers = new Map<string, AudioBuffer>();
  private activeVoice: AudioBufferSourceNode | null = null;
  private activeVoiceCompletion: (() => void) | null = null;

  constructor() {
    void this.preloadVoiceClips();
    // iPadOS can suspend Web Audio again after launch or when a Home Screen app
    // changes lifecycle state. Retry the unlock on every real user interaction.
    window.addEventListener('pointerdown', this.unlock, { capture: true });
    window.addEventListener('keydown', this.unlock, { capture: true });
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopVoice();
    } else {
      this.unlock();
    }
    return this.muted;
  }

  playRecognized(): void {
    this.playTone(523, 0.08, 0.05);
  }

  playDirection(direction: Direction, language: Language): Promise<void> {
    return this.playVoiceClip(language, direction.toLowerCase() as VoiceClip);
  }

  playLetter(letter: Letter, language: Language): Promise<void> {
    return this.playVoiceClip(language, `letter_${letter.toLowerCase()}` as LetterVoiceClip);
  }

  playBump(language: Language): void {
    this.playTone(170, 0.1, 0.055, 'triangle');
    void this.playVoiceClip(language, 'blocked');
  }

  playSuccess(): void {
    if (this.muted) {
      return;
    }

    const context = this.getContext();
    const now = context.currentTime;
    [659, 784, 988, 1319].forEach((frequency, index) => {
      this.scheduleTone(context, frequency, now + index * 0.1, 0.18, 0.055, 'triangle');
    });
    [523, 659, 784].forEach((frequency) => {
      this.scheduleTone(context, frequency, now + 0.38, 0.34, 0.038, 'sine');
    });
    this.scheduleTone(context, 1568, now + 0.44, 0.15, 0.025, 'sine');
    this.scheduleTone(context, 1976, now + 0.56, 0.12, 0.02, 'sine');
  }

  playApplause(): void {
    if (this.muted) {
      return;
    }

    const context = this.getContext();
    const now = context.currentTime + 0.04;
    for (let index = 0; index < 30; index += 1) {
      const start = now + index * 0.065 + Math.random() * 0.05;
      const gain = 0.035 + Math.random() * 0.025;
      const frequency = 1200 + Math.random() * 1700;
      this.scheduleClap(context, start, gain, frequency);
    }
  }

  private readonly unlock = (): void => {
    if (this.muted) {
      return;
    }
    const context = this.getContext();
    if (context.state === 'suspended') {
      this.primeAudioContext(context);
      void context.resume().catch((error) => {
        console.warn('Unable to resume audio yet.', error);
      });
    }
  };

  private primeAudioContext(context: AudioContext): void {
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.start();
    } catch {
      // The following interaction will retry the unlock if WebKit rejects it.
    }
  }

  private async preloadVoiceClips(): Promise<void> {
    const context = this.getContext();
    await Promise.all(
      LANGUAGES.flatMap((language) =>
        VOICE_CLIPS.map(async (clip) => {
          try {
            const response = await fetch(voiceUrl(language, clip));
            if (!response.ok) {
              throw new Error(`${response.status} ${response.statusText}`);
            }
            const audio = await context.decodeAudioData(await response.arrayBuffer());
            this.voiceBuffers.set(voiceKey(language, clip), audio);
          } catch (error) {
            console.warn(`Unable to preload voice clip ${language}/${clip}.`, error);
          }
        }),
      ),
    );
  }

  private async playVoiceClip(language: Language, clip: VoiceClip): Promise<void> {
    if (this.muted) {
      return;
    }

    const buffer = this.voiceBuffers.get(voiceKey(language, clip));
    if (!buffer) {
      return;
    }

    const context = this.getContext();
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
    if (context.state !== 'running') {
      return;
    }

    this.stopVoice();
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.9;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    await new Promise<void>((resolve) => {
      let settled = false;
      let timeoutId: number | null = null;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        if (this.activeVoice === source) {
          this.activeVoice = null;
          this.activeVoiceCompletion = null;
        }
        resolve();
      };

      this.activeVoice = source;
      this.activeVoiceCompletion = finish;
      source.onended = finish;
      // Never let an iOS/WebKit audio lifecycle quirk keep game input locked.
      timeoutId = window.setTimeout(finish, Math.ceil(buffer.duration * 1000) + 500);
      try {
        source.start();
      } catch {
        finish();
      }
    });
  }

  private stopVoice(): void {
    if (!this.activeVoice) {
      return;
    }
    const completion = this.activeVoiceCompletion;
    const source = this.activeVoice;
    this.activeVoice = null;
    this.activeVoiceCompletion = null;
    try {
      source.stop();
    } catch {
      // The source may already have ended between the check and stop call.
    }
    completion?.();
  }

  private playTone(
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
  ): void {
    if (this.muted) {
      return;
    }
    const context = this.getContext();
    this.scheduleTone(context, frequency, context.currentTime, duration, gain, type);
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  private scheduleTone(
    context: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private scheduleClap(
    context: AudioContext,
    start: number,
    gainValue: number,
    frequency: number,
  ): void {
    const duration = 0.095;
    const frameCount = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      const progress = index / frameCount;
      const envelope = Math.exp(-progress * 12);
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.75;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(start + duration + 0.01);
  }
}
