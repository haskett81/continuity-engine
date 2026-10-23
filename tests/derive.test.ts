import { describe, expect, it } from "vitest";
import { clockBand, clockStatus } from "../src/derive/clock.js";
import { dispositionBand, representativeDisposition } from "../src/derive/disposition.js";
import { pressureBand } from "../src/derive/pressure.js";
import { staleness } from "../src/derive/staleness.js";
import { beatDebt } from "../src/derive/beat.js";
import { divergent } from "../src/derive/divergence.js";
import { stripHtml, truncate } from "../src/ui/text.js";

describe("clockStatus", () => {
  it("reports remaining segments and percent", () => {
    expect(clockStatus(3, 8)).toEqual({ complete: false, remaining: 5, percent: 37.5 });
  });

  it("is complete exactly when filled reaches segments", () => {
    expect(clockStatus(7, 8).complete).toBe(false);
    expect(clockStatus(8, 8).complete).toBe(true);
  });

  it("never reports negative remaining or more than 100 percent when overfilled", () => {
    const overfilled = clockStatus(10, 8);
    expect(overfilled.remaining).toBe(0);
    expect(overfilled.percent).toBe(100);
  });

  it("does not produce NaN for a zero-segment clock", () => {
    expect(clockStatus(0, 0).percent).toBe(0);
  });
});

describe("clockBand", () => {
  // The band is the only thing players see for a "vague" clock, so the edges matter.
  it.each([
    [0, "justStarting"],
    [24.9, "justStarting"],
    [25, "building"],
    [74.9, "building"],
    [75, "nearlyThere"],
    [99.9, "nearlyThere"],
    [100, "complete"],
  ])("%s percent is %s", (percent, band) => {
    expect(clockBand(percent)).toBe(band);
  });
});

describe("dispositionBand", () => {
  it.each([
    [0, "neutral"],
    [1, "friendly"],
    [20, "friendly"],
    [21, "allied"],
    [40, "allied"],
    [41, "loyal"],
    [60, "loyal"],
    [61, "factionBoons"],
    [80, "factionBoons"],
    [81, "trusted"],
    [100, "trusted"],
    [-1, "unfriendly"],
    [-20, "unfriendly"],
    [-21, "hostile"],
    [-40, "hostile"],
    [-41, "enemies"],
    [-60, "enemies"],
    [-61, "factionSchemes"],
    [-80, "factionSchemes"],
    [-81, "hated"],
    [-100, "hated"],
  ])("%s is %s", (value, band) => {
    expect(dispositionBand(value)).toBe(band);
  });
});

describe("representativeDisposition", () => {
  it("is zero for a neutral faction", () => {
    expect(representativeDisposition(0)).toBe(0);
  });

  it("gives the band's own boundary, signed", () => {
    expect(representativeDisposition(37)).toBe(40);
    expect(representativeDisposition(-37)).toBe(-40);
    expect(representativeDisposition(100)).toBe(100);
    expect(representativeDisposition(-100)).toBe(-100);
  });

  it("maps back to the same band for every possible value (players see the band, never the number)", () => {
    for (let value = -100; value <= 100; value++) {
      expect(dispositionBand(representativeDisposition(value))).toBe(dispositionBand(value));
    }
  });

  it("never gives away the true number unless it already sits on a boundary", () => {
    for (let value = -100; value <= 100; value++) {
      if (value % 20 !== 0) expect(representativeDisposition(value)).not.toBe(value);
    }
  });
});

describe("pressureBand", () => {
  it.each([
    [0, "background"],
    [2, "background"],
    [3, "building"],
    [5, "building"],
    [6, "urgent"],
    [8, "urgent"],
    [9, "breaking"],
    [10, "breaking"],
  ])("pressure %s is %s", (value, band) => {
    expect(pressureBand(value)).toBe(band);
  });
});

describe("session counters", () => {
  it("staleness counts sessions since a thread was last touched", () => {
    expect(staleness(2, 6)).toBe(4);
    expect(staleness(6, 6)).toBe(0);
  });

  it("beat debt counts sessions since a beat was last served", () => {
    expect(beatDebt(1, 5)).toBe(4);
    expect(beatDebt(5, 5)).toBe(0);
  });
});

describe("divergent (the party believes something that is not true)", () => {
  it("is true for a non-empty belief marked lie or rumour", () => {
    expect(divergent("The duke is loyal", "lie")).toBe(true);
    expect(divergent("The duke is loyal", "rumour")).toBe(true);
  });

  it("is false for confirmed or corroborated beliefs", () => {
    expect(divergent("The duke is loyal", "confirmed")).toBe(false);
    expect(divergent("The duke is loyal", "corroborated")).toBe(false);
  });

  it("is false when the party believes nothing yet", () => {
    expect(divergent("", "lie")).toBe(false);
    expect(divergent("   ", "rumour")).toBe(false);
  });
});

describe("text helpers", () => {
  it("stripHtml removes tags, so an empty editor field counts as empty", () => {
    expect(stripHtml("<p></p>")).toBe("");
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("truncate shortens long text and leaves short text alone", () => {
    expect(truncate("  short  ", 20)).toBe("short");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});
