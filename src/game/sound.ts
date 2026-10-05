import type { Language } from './i18n';
import type { Direction } from './types';

type VoiceClip = 'up' | 'down' | 'left' | 'right' | 'blocked';

const VOICE_CLIPS: readonly VoiceClip[] = ['up', 'down', 'left', 'right', 'blocked'];
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

  constructor() {
    void this.preloadVoiceClips();
    window.addEventListener('pointerdown', this.unlock, { capture: true, once: true });
    window.addEventListener('keydown', this.unlock, { capture: true, once: true });
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

  playDirection(direction: Direction, language: Language): void {
    this.playVoiceClip(language, direction.toLowerCase() as VoiceClip);
  }

  playBump(language: Language): void {
    this.playTone(170, 0.1, 0.055, 'triangle');
    this.playVoiceClip(language, 'blocked');
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

  private readonly unlock = (): void => {
    if (this.muted) {
      return;
    }
    const context = this.getContext();
    if (context.state === 'suspended') {
      void context.resume();
    }
  };

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

  private playVoiceClip(language: Language, clip: VoiceClip): void {
    if (this.muted) {
      return;
    }

    const buffer = this.voiceBuffers.get(voiceKey(language, clip));
    if (!buffer) {
      return;
    }

    const context = this.getContext();
    this.stopVoice();
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.9;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      if (this.activeVoice === source) {
        this.activeVoice = null;
      }
    };
    this.activeVoice = source;
    source.start();
  }

  private stopVoice(): void {
    if (!this.activeVoice) {
      return;
    }
    try {
      this.activeVoice.stop();
    } catch {
      // The source may already have ended between the check and stop call.
    }
    this.activeVoice = null;
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
}
