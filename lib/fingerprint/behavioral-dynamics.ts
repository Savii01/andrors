/**
 * Passive Behavioral Biometrics Collector
 * Zero-dependency, zero-cost browser telemetry for detecting synthetic input.
 */

export interface BehavioralPayload {
  isTrusted: boolean;
  mouseCurvature: number;
  avgDwellMs: number;
  isHumanDynamics: boolean;
}

interface MousePoint {
  x: number;
  y: number;
  t: number;
}

let mousePoints: MousePoint[] = [];
let dwellSamples: number[] = [];
let lastSubmitTrusted = true;
let collectionActive = false;

function distance(a: MousePoint, b: MousePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function totalPathLength(points: MousePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i - 1], points[i]);
  }
  return len;
}

function straightLineDistance(points: MousePoint[]): number {
  if (points.length < 2) return 0;
  return distance(points[0], points[points.length - 1]);
}

/**
 * Start collecting behavioral signals. Call once on form mount.
 * Attaches passive listeners to the document.
 */
export function startBehavioralCollection(): void {
  if (collectionActive || typeof window === 'undefined') return;
  collectionActive = true;
  mousePoints = [];
  dwellSamples = [];

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('keydown', onKeyDown, { passive: true });
  document.addEventListener('keyup', onKeyUp, { passive: true });
}

function onMouseMove(e: MouseEvent): void {
  if (mousePoints.length < 500) {
    mousePoints.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  }
}

const keyDownTimes = new Map<string, number>();

function onKeyDown(e: KeyboardEvent): void {
  keyDownTimes.set(e.key, performance.now());
}

function onKeyUp(e: KeyboardEvent): void {
  const downTime = keyDownTimes.get(e.key);
  if (downTime !== undefined) {
    const dwell = performance.now() - downTime;
    keyDownTimes.delete(e.key);
    if (dwell > 5 && dwell < 2000) {
      dwellSamples.push(dwell);
    }
  }
}

function onSubmitCapture(e: Event): void {
  lastSubmitTrusted = (e as any).isTrusted === true;
}

/**
 * Stop collecting and clean up listeners.
 */
export function stopBehavioralCollection(): void {
  if (!collectionActive) return;
  collectionActive = false;

  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('submit', onSubmitCapture, true);
}

/**
 * Capture the isTrusted flag from a real submit event.
 * Call this from the form's onSubmit handler.
 */
export function captureSubmitTrust(e: React.FormEvent): void {
  lastSubmitTrusted = (e.nativeEvent as any).isTrusted === true;
}

/**
 * Compute and return the behavioral payload.
 * Safe to call even if collection never started — returns defaults.
 */
export function collectBehavioralPayload(): BehavioralPayload {
  const isTrusted = lastSubmitTrusted;

  let mouseCurvature = 1;
  if (mousePoints.length >= 3) {
    const path = totalPathLength(mousePoints);
    const straight = straightLineDistance(mousePoints);
    mouseCurvature = straight > 0 ? path / straight : 1;
  }

  let avgDwellMs = 120;
  if (dwellSamples.length > 0) {
    const sum = dwellSamples.reduce((a, b) => a + b, 0);
    avgDwellMs = sum / dwellSamples.length;
  }

  const curvatureOk = mouseCurvature >= 1.0 && mouseCurvature <= 8.0;
  const dwellOk = avgDwellMs >= 30 && avgDwellMs <= 800;
  const isHumanDynamics = isTrusted && curvatureOk && dwellOk;

  return {
    isTrusted,
    mouseCurvature: Math.round(mouseCurvature * 100) / 100,
    avgDwellMs: Math.round(avgDwellMs),
    isHumanDynamics,
  };
}

/**
 * Reset state between login attempts.
 */
export function resetBehavioralState(): void {
  mousePoints = [];
  dwellSamples = [];
  lastSubmitTrusted = true;
  keyDownTimes.clear();
}
