export const DEFAULT_PREVIEW_ZOOM = 0.78;
export const MIN_PREVIEW_ZOOM = 0.5;
export const MAX_PREVIEW_ZOOM = 1.15;
export const PREVIEW_ZOOM_STEP = 0.08;

export function stepPreviewZoom(current: number, direction: -1 | 1): number {
  const next = current + PREVIEW_ZOOM_STEP * direction;
  return Math.round(Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, next)) * 100) / 100;
}
