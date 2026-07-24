// The Continuity Engine mark: a ten-tooth gear ring around a hexagonal die
// face. Ported from the design book's own `mark()` JS generator
// (continuity-engine-design-book.html) — same geometry, same defaults.
export function ceMarkShapes(gear = "#b8913f", plate = "#1d1c19", die = "#e6dcc0"): string {
  const teeth = Array.from(
    { length: 10 },
    (_, i) => `<rect x="46" y="1.5" width="8" height="15" rx="2" fill="${gear}" transform="rotate(${i * 36} 50 50)"/>`,
  ).join("");
  const poly = (r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    }).join(" ");
  const tri = [0, 2, 4]
    .map((i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      return `${50 + 13 * Math.cos(a)},${50 + 13 * Math.sin(a)}`;
    })
    .join(" ");
  const spokes = [0, 2, 4]
    .map((i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      const x1 = 50 + 13 * Math.cos(a);
      const y1 = 50 + 13 * Math.sin(a);
      const x2 = 50 + 24 * Math.cos(a);
      const y2 = 50 + 24 * Math.sin(a);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${die}" stroke-width="3"/>`;
    })
    .join("");
  return `${teeth}<circle cx="50" cy="50" r="38" fill="none" stroke="${gear}" stroke-width="8"/>
    <circle cx="50" cy="50" r="33" fill="${plate}"/>
    <polygon points="${poly(24)}" fill="none" stroke="${die}" stroke-width="3.5" stroke-linejoin="round"/>
    <polygon points="${tri}" fill="none" stroke="${die}" stroke-width="3" stroke-linejoin="round"/>${spokes}`;
}

export function ceMarkSvg(className = "", gear?: string, plate?: string, die?: string): string {
  return `<svg viewBox="0 0 100 100" class="${className}" aria-hidden="true">${ceMarkShapes(gear, plate, die)}</svg>`;
}
