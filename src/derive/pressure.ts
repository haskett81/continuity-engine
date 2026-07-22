const BANDS = [
  { max: 2, key: "background" },
  { max: 5, key: "building" },
  { max: 8, key: "urgent" },
  { max: 10, key: "breaking" },
];

/**
 * Sheet UX spec §2.1: pressure band legend — 0–2/3–5/6–8/9–10. Returns a
 * stable key (matching lang/en.json's CE.thread.pressure.band.<key>), not a
 * display string — localize at the call site.
 */
export function pressureBand(value: number): string {
  return BANDS.find((b) => value <= b.max)?.key ?? "breaking";
}
