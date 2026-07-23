const POSITIVE_BANDS = ["friendly", "allied", "loyal", "factionBoons", "trusted"];
const NEGATIVE_BANDS = ["unfriendly", "hostile", "enemies", "factionSchemes", "hated"];

/**
 * Sheet UX spec §2.2 band resolution: 0 is Neutral. Otherwise the band is
 * chosen by ceil(|value| / 20) in the value's direction — so +1…+20 is
 * Friendly, +21…+40 Allied, and so on, across the -100..+100 range. Returns
 * a stable key (matching lang/en.json's CE.faction.disposition.band.<key>),
 * not a display string — localize at the call site.
 */
export function dispositionBand(value: number): string {
  if (value === 0) return "neutral";
  const index = Math.min(Math.ceil(Math.abs(value) / 20), 5);
  return value > 0 ? POSITIVE_BANDS[index - 1]! : NEGATIVE_BANDS[index - 1]!;
}

/**
 * P4: the number a published Faction copy carries instead of the real
 * disposition — the band's own boundary (20/40/60/80/100, signed), which
 * `dispositionBand()` maps back to the identical band and nothing more
 * precise. `dispositionBand` itself is a derived field, not schema — a
 * publish copy can't carry a derived value directly, so it re-derives from
 * this representative number instead of the true one.
 */
export function representativeDisposition(value: number): number {
  if (value === 0) return 0;
  const index = Math.min(Math.ceil(Math.abs(value) / 20), 5);
  return value > 0 ? index * 20 : -(index * 20);
}
