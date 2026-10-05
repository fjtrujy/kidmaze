import { speechLocale, type Language } from './i18n';

const PREFERRED_VOICE_NAMES: Record<Language, readonly string[]> = {
  en: [
    'Flo',
    'Shelley',
    'Sandy',
    'Samantha',
    'Serena',
    'Kate',
    'Moira',
    'Fiona',
    'Karen',
    'Tessa',
    'Victoria',
    'Microsoft Sonia',
    'Microsoft Libby',
    'Microsoft Aria',
    'Google UK English Female',
  ],
  es: [
    'Flo',
    'Shelley',
    'Sandy',
    'Mónica',
    'Monica',
    'Helena',
    'Laura',
    'Paulina',
    'Ximena',
    'Microsoft Elvira',
    'Microsoft Helena',
    'Google español',
  ],
};

export class SoundController {
  private context: AudioContext | null = null;
  private muted = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.refreshVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', this.refreshVoices);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.muted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this.muted;
  }

  playRecognized(): void {
    this.playTone(523, 0.08, 0.05);
  }

  speak(text: string, language: Language, interrupt = true): void {
    if (this.muted || !('speechSynthesis' in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(language);
    const voice = this.preferredVoice(language);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 0.84;
    utterance.pitch = 1.12;
    utterance.volume = 0.92;
    if (interrupt) {
      window.speechSynthesis.cancel();
    }
    window.speechSynthesis.speak(utterance);
  }

  playBump(language: Language): void {
    this.playTone(170, 0.1, 0.055, 'triangle');
    this.speak('No, no', language, false);
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

  private readonly refreshVoices = (): void => {
    if (!('speechSynthesis' in window)) {
      this.voices = [];
      return;
    }
    this.voices = window.speechSynthesis.getVoices();
  };

  private preferredVoice(language: Language): SpeechSynthesisVoice | undefined {
    if (this.voices.length === 0) {
      this.refreshVoices();
    }

    const locale = speechLocale(language).toLowerCase();
    const baseLanguage = locale.split('-')[0];
    const preferredNames = PREFERRED_VOICE_NAMES[language];

    return [...this.voices]
      .filter((voice) => voice.lang.toLowerCase().startsWith(baseLanguage))
      .sort((a, b) => this.voiceScore(b, locale, preferredNames) - this.voiceScore(a, locale, preferredNames))[0];
  }

  private voiceScore(
    voice: SpeechSynthesisVoice,
    locale: string,
    preferredNames: readonly string[],
  ): number {
    const name = voice.name.toLowerCase();
    const preferredIndex = preferredNames.findIndex((candidate) => name.includes(candidate.toLowerCase()));
    let score = preferredIndex >= 0 ? 200 - preferredIndex * 5 : 0;

    if (voice.lang.toLowerCase() === locale) {
      score += 40;
    }
    if (voice.localService) {
      score += 8;
    }
    if (/enhanced|premium|natural/.test(name)) {
      score += 25;
    }
    if (/compact|espeak/.test(name)) {
      score -= 30;
    }
    return score;
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
    if (this.context.state === 'suspended') {
      void this.context.resume();
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
