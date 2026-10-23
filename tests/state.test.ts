import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, installFoundry, makePage, OWNERSHIP } from "./helpers/foundry-fakes.js";

type World = ReturnType<typeof installFoundry>;

let world: World;

beforeEach(() => {
  vi.resetModules();
  world = installFoundry();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("faction attitude rescale (runs once per world)", () => {
  async function load() {
    const migrations = await import("../src/state/migrations.js");
    migrations.registerSchemaVersionSetting();
    return migrations;
  }

  it("rescales the old -5..+5 numbers to -100..+100", async () => {
    const three = world.addPage(makePage({ type: "continuity-engine.faction", system: { disposition: 3 } }));
    const minusFive = world.addPage(makePage({ type: "continuity-engine.faction", system: { disposition: -5 } }));
    const zero = world.addPage(makePage({ type: "continuity-engine.faction", system: { disposition: 0 } }));

    const { runMigrations } = await load();
    await runMigrations();

    expect(three.update).toHaveBeenCalledWith({ "system.disposition": 60 });
    expect(minusFive.update).toHaveBeenCalledWith({ "system.disposition": -100 });
    expect(zero.update).toHaveBeenCalledWith({ "system.disposition": 0 });
  });

  it("records that it ran, and does nothing the second time", async () => {
    const page = world.addPage(makePage({ type: "continuity-engine.faction", system: { disposition: 2 } }));
    const { runMigrations } = await load();

    await runMigrations();
    expect(world.settingsStore.get("schemaVersion")).toBe(1);
    expect(page.update).toHaveBeenCalledTimes(1);

    await runMigrations();
    expect(page.update).toHaveBeenCalledTimes(1);
  });

  it("leaves a world alone when it is already on the current version", async () => {
    const page = world.addPage(makePage({ type: "continuity-engine.faction", system: { disposition: 60 } }));
    const { runMigrations } = await load();
    world.settingsStore.set("schemaVersion", 1);

    await runMigrations();

    expect(page.update).not.toHaveBeenCalled();
  });

  it("never rescales a published copy (its number is already a stand-in)", async () => {
    const copy = world.addPage(
      makePage({ type: "continuity-engine.faction", system: { disposition: 40 }, flags: { isPublishedCopy: true } }),
    );
    const { runMigrations } = await load();

    await runMigrations();

    expect(copy.update).not.toHaveBeenCalled();
  });

  it("registers its setting as hidden and world-wide, starting at zero", async () => {
    await load();
    const setting = world.registeredSettings.find((s) => s.key === "schemaVersion");
    expect(setting?.data).toMatchObject({ scope: "world", config: false, default: 0 });
  });
});

describe("GM-only pages", () => {
  const NONE = OWNERSHIP.NONE;

  async function register() {
    const { registerGmOnlyEnforcement } = await import("../src/state/gm-only.js");
    registerGmOnlyEnforcement();
  }

  it.each([
    "continuity-engine.thread",
    "continuity-engine.clock",
    "continuity-engine.faction",
    "continuity-engine.knowledge",
    "continuity-engine.session",
    "continuity-engine.beat",
  ])("a new %s page is created hidden from players", async (type) => {
    await register();
    const doc = { updateSource: vi.fn() };
    await world.fire("preCreateJournalEntryPage", doc, { type });
    expect(doc.updateSource).toHaveBeenCalledWith({ "ownership.default": NONE });
  });

  it("does not touch pages from other modules", async () => {
    await register();
    const doc = { updateSource: vi.fn() };
    await world.fire("preCreateJournalEntryPage", doc, { type: "text" });
    expect(doc.updateSource).not.toHaveBeenCalled();
  });

  it("lets a published copy be created readable (that is its whole point)", async () => {
    await register();
    const doc = { updateSource: vi.fn() };
    await world.fire("preCreateJournalEntryPage", doc, {
      type: "continuity-engine.thread",
      flags: { "continuity-engine": { isPublishedCopy: true } },
    });
    expect(doc.updateSource).not.toHaveBeenCalled();
  });

  it("every save of a continuity page re-asserts hidden-by-default, keeping other people's access", async () => {
    await register();
    const doc = { type: "continuity-engine.clock", getFlag: () => undefined };
    const changes = { ownership: { default: OWNERSHIP.OBSERVER, someUser: OWNERSHIP.OWNER } };
    await world.fire("preUpdateJournalEntryPage", doc, changes);
    expect(changes.ownership).toEqual({ default: NONE, someUser: OWNERSHIP.OWNER });
  });

  it("stamps hidden on a save that did not mention ownership at all (older pages)", async () => {
    await register();
    const doc = { type: "continuity-engine.beat", getFlag: () => undefined };
    const changes: { ownership?: { default?: number } } = {};
    await world.fire("preUpdateJournalEntryPage", doc, changes);
    expect(changes.ownership).toEqual({ default: NONE });
  });

  it("leaves published copies and other modules' pages alone on save", async () => {
    await register();
    const copy = { type: "continuity-engine.thread", getFlag: () => true };
    const copyChanges: { ownership?: { default?: number } } = {};
    await world.fire("preUpdateJournalEntryPage", copy, copyChanges);
    expect(copyChanges.ownership).toBeUndefined();

    const other = { type: "text", getFlag: () => undefined };
    const otherChanges: { ownership?: { default?: number } } = {};
    await world.fire("preUpdateJournalEntryPage", other, otherChanges);
    expect(otherChanges.ownership).toBeUndefined();
  });
});

describe("current session", () => {
  const sessionPage = (number: number, isCurrent: boolean, extra: Record<string, unknown> = {}) =>
    makePage({ type: "continuity-engine.session", system: { number, isCurrent }, ...extra });

  it("is 0 before any session exists", async () => {
    const { getCurrentSession, getCurrentSessionPage } = await import("../src/state/session.js");
    expect(getCurrentSession()).toBe(0);
    expect(getCurrentSessionPage()).toBeNull();
  });

  it("uses the page flagged current, even if another has a higher number", async () => {
    world.addPage(sessionPage(5, false));
    const flagged = world.addPage(sessionPage(3, true));
    const { getCurrentSession, getCurrentSessionPage } = await import("../src/state/session.js");
    expect(getCurrentSession()).toBe(3);
    expect(getCurrentSessionPage()).toBe(flagged);
  });

  it("falls back to the highest session number when none is flagged", async () => {
    world.addPage(sessionPage(2, false));
    const highest = world.addPage(sessionPage(7, false));
    world.addPage(sessionPage(4, false));
    const { getCurrentSession, getCurrentSessionPage } = await import("../src/state/session.js");
    expect(getCurrentSession()).toBe(7);
    expect(getCurrentSessionPage()).toBe(highest);
  });

  it("ignores published copies of session pages", async () => {
    world.addPage(sessionPage(9, true, { flags: { isPublishedCopy: true } }));
    world.addPage(sessionPage(2, false));
    const { getCurrentSession } = await import("../src/state/session.js");
    expect(getCurrentSession()).toBe(2);
  });

  it("setCurrentSession flags the chosen page and clears the old flag", async () => {
    const old = world.addPage(sessionPage(1, true, { uuid: "old" }));
    const next = world.addPage(sessionPage(2, false, { uuid: "next" }));
    const { setCurrentSession } = await import("../src/state/session.js");

    await setCurrentSession("next");

    expect(old.update).toHaveBeenCalledWith({ "system.isCurrent": false });
    expect(next.update).toHaveBeenCalledWith({ "system.isCurrent": true });
  });
});

describe("session tracker (what End Session offers to stamp)", () => {
  async function setup() {
    const tracker = await import("../src/state/session-tracker.js");
    tracker.registerSessionTracker();
    return tracker;
  }

  it("remembers threads that were edited", async () => {
    const tracker = await setup();
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.thread", uuid: "t1" }, {});
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.thread", uuid: "t1" }, {});
    expect(tracker.getTracked().threads).toEqual(["t1"]);
  });

  it("remembers clocks only when their fill changed", async () => {
    const tracker = await setup();
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.clock", uuid: "c1" }, { system: { filled: 2 } });
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.clock", uuid: "c2" }, { system: { trigger: "x" } });
    expect(tracker.getTracked().clocks).toEqual(["c1"]);
  });

  it("counts a clock moved back to zero as advanced", async () => {
    const tracker = await setup();
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.clock", uuid: "c1" }, { system: { filled: 0 } });
    expect(tracker.getTracked().clocks).toEqual(["c1"]);
  });

  it("ignores other page types and can be reset", async () => {
    const tracker = await setup();
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.faction", uuid: "f1" }, {});
    expect(tracker.getTracked()).toEqual({ threads: [], clocks: [] });

    await world.fire("updateJournalEntryPage", { type: "continuity-engine.thread", uuid: "t1" }, {});
    tracker.resetTracker();
    expect(tracker.getTracked()).toEqual({ threads: [], clocks: [] });
  });
});

describe("Begin Session", () => {
  it("creates the next numbered session page and makes it current", async () => {
    world.addPage(makePage({ type: "continuity-engine.session", uuid: "s1", system: { number: 4, isCurrent: true } }));
    const { beginSession } = await import("../src/state/session-lifecycle.js");

    await beginSession();

    const created = world.createdPages.at(-1);
    expect(created?.data).toMatchObject({
      name: "Session 5",
      type: "continuity-engine.session",
      system: { number: 5 },
    });
  });

  it("starts at session 1 in an empty world", async () => {
    const { beginSession } = await import("../src/state/session-lifecycle.js");
    await beginSession();
    expect(world.createdPages.at(-1)?.data).toMatchObject({ name: "Session 1", system: { number: 1 } });
  });

  it("clears the tracker so the new session starts clean", async () => {
    const tracker = await import("../src/state/session-tracker.js");
    tracker.registerSessionTracker();
    await world.fire("updateJournalEntryPage", { type: "continuity-engine.thread", uuid: "t1" }, {});
    const { beginSession } = await import("../src/state/session-lifecycle.js");

    await beginSession();
    await flush();

    expect(tracker.getTracked().threads).toEqual([]);
  });
});

describe("Cockpit board (what needs the GM's attention)", () => {
  async function board() {
    world.settingsStore.set("ledger", { config: { staleThreshold: 3, beatDebtThreshold: 3 } });
    const { prepareBoardContext } = await import("../src/apps/cockpit/tabs/board.js");
    return prepareBoardContext() as {
      staleThreads: { name: string }[];
      nearClocks: { name: string; remaining: number }[];
      beatDebt: { name: string }[];
      divergentKnowledge: { name: string }[];
      nothingFlagged: boolean;
    };
  }

  const thread = (name: string, status: string, staleness: number) =>
    world.addPage(makePage({ name, type: "continuity-engine.thread", system: { status, staleness } }));
  const clock = (name: string, complete: boolean, remaining: number) =>
    world.addPage(makePage({ name, type: "continuity-engine.clock", system: { complete, remaining } }));
  const beat = (name: string, stage: string, debt: number) =>
    world.addPage(makePage({ name, type: "continuity-engine.beat", system: { stage, debt } }));

  it("says nothing is flagged for a quiet campaign", async () => {
    thread("Quiet", "open", 1);
    expect((await board()).nothingFlagged).toBe(true);
  });

  it("flags open threads that have gone stale, most stale first", async () => {
    thread("A little stale", "open", 3);
    thread("Very stale", "open", 6);
    thread("Fine", "open", 2);
    thread("Resolved long ago", "resolved", 9);
    const result = await board();
    expect(result.staleThreads.map((t) => t.name)).toEqual(["Very stale", "A little stale"]);
    expect(result.nothingFlagged).toBe(false);
  });

  it("flags clocks one step from done, closest first, and skips finished ones", async () => {
    clock("Almost", false, 1);
    clock("Far away", false, 4);
    clock("Finished", true, 0);
    const result = await board();
    expect(result.nearClocks.map((c) => c.name)).toEqual(["Almost"]);
  });

  it("flags unresolved beats that are overdue, worst first", async () => {
    beat("Overdue", "surfaced", 3);
    beat("Very overdue", "seeded", 7);
    beat("Done", "resolved", 9);
    beat("On time", "seeded", 1);
    const result = await board();
    expect(result.beatDebt.map((b) => b.name)).toEqual(["Very overdue", "Overdue"]);
  });

  it("flags knowledge where the party believes something untrue", async () => {
    world.addPage(makePage({ name: "Mistaken", type: "continuity-engine.knowledge", system: { divergent: true } }));
    world.addPage(makePage({ name: "Correct", type: "continuity-engine.knowledge", system: { divergent: false } }));
    const result = await board();
    expect(result.divergentKnowledge.map((k) => k.name)).toEqual(["Mistaken"]);
  });

  it("respects the thresholds set in the campaign settings", async () => {
    thread("Stale at two", "open", 2);
    world.settingsStore.set("ledger", { config: { staleThreshold: 2, beatDebtThreshold: 3 } });
    const { prepareBoardContext } = await import("../src/apps/cockpit/tabs/board.js");
    const result = prepareBoardContext() as { staleThreads: { name: string }[] };
    expect(result.staleThreads.map((t) => t.name)).toEqual(["Stale at two"]);
  });

  it("does not count published copies", async () => {
    world.addPage(
      makePage({
        name: "Copy",
        type: "continuity-engine.thread",
        system: { status: "open", staleness: 9 },
        flags: { isPublishedCopy: true },
      }),
    );
    expect((await board()).staleThreads).toEqual([]);
  });
});
