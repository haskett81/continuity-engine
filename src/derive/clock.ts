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

/**
 * P4: the coarse label a `vague`-visibility clock shows players — a band,
 * never the exact segment count. Matches lang keys CE.clock.band.<key>.
 */
export function clockBand(percent: number): string {
  if (percent >= 100) return "complete";
  if (percent >= 75) return "nearlyThere";
  if (percent >= 25) return "building";
  return "justStarting";
}
