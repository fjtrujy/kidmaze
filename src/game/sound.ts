import { speechLocale, type Language } from './i18n';

export class SoundController {
  private context: AudioContext | null = null;
  private muted = false;

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
    utterance.rate = 0.88;
    utterance.pitch = 1.08;
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
    [523, 659, 784].forEach((frequency, index) => {
      this.scheduleTone(context, frequency, now + index * 0.09, 0.13, 0.045, 'sine');
    });
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
