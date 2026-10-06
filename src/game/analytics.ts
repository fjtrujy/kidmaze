type AnalyticsValue = string | number | boolean;
type AnalyticsData = Record<string, AnalyticsValue>;

interface UmamiTracker {
  track(name: string, data?: AnalyticsData): void;
}

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

interface PendingEvent {
  name: string;
  data?: AnalyticsData;
}

const PRODUCTION_HOST = 'fjtrujy.github.io';
const MAX_PENDING_EVENTS = 24;

export class AnalyticsController {
  private readonly pending: PendingEvent[] = [];

  constructor() {
    window.addEventListener('load', () => this.flush(), { once: true });
  }

  track(name: string, data?: AnalyticsData): void {
    if (!this.enabled) {
      return;
    }

    const tracker = window.umami;
    if (tracker) {
      tracker.track(name, data);
      return;
    }

    if (this.pending.length < MAX_PENDING_EVENTS) {
      this.pending.push({ name, data });
    }
  }

  private get enabled(): boolean {
    return import.meta.env.PROD && window.location.hostname === PRODUCTION_HOST;
  }

  private flush(): void {
    if (!this.enabled || !window.umami) {
      return;
    }

    for (const event of this.pending.splice(0)) {
      window.umami.track(event.name, event.data);
    }
  }
}

export const analytics = new AnalyticsController();
