import type { Drawing, Point } from './types';

type DrawingCallback = (strokes: Drawing) => void;

const DRAWING_IDLE_MS = 5000;

export class DrawingCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly onDrawingFinished: DrawingCallback;
  private readonly resizeObserver: ResizeObserver;
  private strokes: Point[][] = [];
  private activeStroke: Point[] = [];
  private activePointerId: number | null = null;
  private idleTimer: number | null = null;
  private enabled = true;

  constructor(canvas: HTMLCanvasElement, onDrawingFinished: DrawingCallback) {
    this.canvas = canvas;
    this.onDrawingFinished = onDrawingFinished;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas support is required.');
    }
    this.context = context;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

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
    this.cancelIdleTimer();
    if (this.activePointerId !== null && this.canvas.hasPointerCapture(this.activePointerId)) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.strokes = [];
    this.activeStroke = [];
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.activePointerId !== null || event.button > 0) {
      return;
    }

    event.preventDefault();
    this.cancelIdleTimer();
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
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

    this.canvas.releasePointerCapture(event.pointerId);
    this.activePointerId = null;
    this.strokes.push([...this.activeStroke]);
    this.activeStroke = [];
    this.scheduleRecognition();
  };

  private cancelActiveStroke(): void {
    this.clear();
  }

  private scheduleRecognition(): void {
    this.cancelIdleTimer();
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      if (!this.enabled || this.activePointerId !== null || this.strokes.length === 0) {
        return;
      }

      const drawing = this.strokes.map((stroke) => [...stroke]);
      this.onDrawingFinished(drawing);
    }, DRAWING_IDLE_MS);
  }

  private cancelIdleTimer(): void {
    if (this.idleTimer === null) {
      return;
    }
    window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
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
    this.cancelIdleTimer();
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

