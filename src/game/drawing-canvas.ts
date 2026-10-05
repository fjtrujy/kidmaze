import type { Drawing, Point } from './types';
import { DRAWING_IDLE_BEFORE_SCAN_MS, DRAWING_SCAN_DURATION_MS } from './drawing-timing';

type DrawingCallback = (strokes: Drawing) => void;

export class DrawingCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly scanner: HTMLElement;
  private readonly onDrawingFinished: DrawingCallback;
  private readonly resizeObserver: ResizeObserver;
  private strokes: Point[][] = [];
  private activeStroke: Point[] = [];
  private activePointerId: number | null = null;
  private idleTimer: number | null = null;
  private scanTimer: number | null = null;
  private enabled = true;

  constructor(canvas: HTMLCanvasElement, scanner: HTMLElement, onDrawingFinished: DrawingCallback) {
    this.canvas = canvas;
    this.scanner = scanner;
    this.onDrawingFinished = onDrawingFinished;
    this.scanner.style.setProperty('--scan-duration', `${DRAWING_SCAN_DURATION_MS}ms`);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas support is required.');
    }
    this.context = context;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('lostpointercapture', this.handleLostPointerCapture);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.canvas.classList.toggle('is-disabled', !enabled);
    if (!enabled) {
      this.cancelActiveStroke();
    }
  }

  clear(): void {
    this.cancelPendingRecognition();
    if (this.activePointerId !== null) {
      this.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.strokes = [];
    this.activeStroke = [];
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.cancelPendingRecognition();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.handleLostPointerCapture);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.activePointerId !== null || event.button > 0) {
      return;
    }

    event.preventDefault();
    this.cancelPendingRecognition();
    this.activePointerId = event.pointerId;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Safari can reject pointer capture during a system gesture. Drawing can
      // still continue while the pointer remains over the canvas.
    }
    this.activeStroke = [this.eventPoint(event)];
    this.drawDot(this.activeStroke[0]);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    const point = this.eventPoint(event);
    const previous = this.activeStroke[this.activeStroke.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5) {
      return;
    }

    this.activeStroke.push(point);
    this.drawSegment(previous, point);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    const point = this.eventPoint(event);
    const previous = this.activeStroke[this.activeStroke.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.5) {
      this.activeStroke.push(point);
      this.drawSegment(previous, point);
    }

    const finishedStroke = [...this.activeStroke];
    this.activePointerId = null;
    this.activeStroke = [];
    this.releasePointerCapture(event.pointerId);
    this.strokes.push(finishedStroke);
    this.scheduleRecognition();
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
    this.activePointerId = null;
    this.activeStroke = [];
    this.releasePointerCapture(event.pointerId);
  };

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.activePointerId = null;
    this.activeStroke = [];
  };

  private releasePointerCapture(pointerId: number): void {
    try {
      if (this.canvas.hasPointerCapture(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // WebKit may have already released capture as part of a system gesture.
    }
  }

  private cancelActiveStroke(): void {
    this.clear();
  }

  private scheduleRecognition(): void {
    this.cancelPendingRecognition();
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      if (!this.enabled || this.activePointerId !== null || this.strokes.length === 0) {
        return;
      }

      this.startScanner();
      this.scanTimer = window.setTimeout(() => {
        this.scanTimer = null;
        this.stopScanner();
        if (!this.enabled || this.activePointerId !== null || this.strokes.length === 0) {
          return;
        }

        const drawing = this.strokes.map((stroke) => [...stroke]);
        this.onDrawingFinished(drawing);
      }, DRAWING_SCAN_DURATION_MS);
    }, DRAWING_IDLE_BEFORE_SCAN_MS);
  }

  private cancelPendingRecognition(): void {
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    this.stopScanner();
  }

  private startScanner(): void {
    this.scanner.classList.remove('is-scanning');
    void this.scanner.offsetWidth;
    this.scanner.classList.add('is-scanning');
  }

  private stopScanner(): void {
    this.scanner.classList.remove('is-scanning');
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));

    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.lineWidth = Math.max(10, Math.min(rect.width, rect.height) * 0.038);
    this.context.strokeStyle = '#1f456e';
    this.context.fillStyle = '#1f456e';
    this.cancelPendingRecognition();
    this.strokes = [];
    this.activeStroke = [];
  }

  private eventPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private drawDot(point: Point): void {
    this.context.beginPath();
    this.context.arc(point.x, point.y, this.context.lineWidth / 2, 0, Math.PI * 2);
    this.context.fill();
  }

  private drawSegment(from: Point, to: Point): void {
    this.context.beginPath();
    this.context.moveTo(from.x, from.y);
    this.context.lineTo(to.x, to.y);
    this.context.stroke();
  }
}

