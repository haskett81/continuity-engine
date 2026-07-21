export interface ClockStatus {
  complete: boolean;
  remaining: number;
  percent: number;
}

/** Spec §4.2: complete / remaining / percent, derived from filled and segments. */
export function clockStatus(filled: number, segments: number): ClockStatus {
  const remaining = Math.max(segments - filled, 0);
  const percent = segments > 0 ? Math.min(filled / segments, 1) * 100 : 0;
  return { complete: filled >= segments, remaining, percent };
}
