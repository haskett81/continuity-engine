import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, installFoundry, makePage, OWNERSHIP, type FakePage } from "./helpers/foundry-fakes.js";
import { dispositionBand } from "../src/derive/disposition.js";

type World = ReturnType<typeof installFoundry>;
type PublishModule = typeof import("../src/state/publish.js");

let world: World;
let publish: PublishModule;

beforeEach(async () => {
  vi.resetModules();
  world = installFoundry();
  publish = await import("../src/state/publish.js");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SECRET = "TOP-SECRET-GM-NOTE";

function source(type: string, system: Record<string, unknown>, name = "Source"): FakePage {
  // Every source carries a GM-only field that must never reach a player copy.
  return makePage({ type, name, system: { ...system, gmNotes: SECRET, truth: SECRET, agenda: SECRET } });
}

function lastCopy() {
  const created = world.createdPages.at(-1);
  if (!created) throw new Error("no published copy was created");
  return created;
}

describe("what players are allowed to receive", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["continuity-engine.beat", { actor: "Actor.1", hook: "A debt", playerVisible: true, debt: 9, stage: "seeded" }],
    ["continuity-engine.thread", { status: "open", stakes: "The city", pressure: 9, playerVisible: true }],
    ["continuity-engine.faction", { disposition: -37, currentMove: "Recruiting", playerVisible: true }],
    ["continuity-engine.clock", { filled: 3, segments: 8, direction: "doom", visibility: "vague" }],
    ["continuity-engine.clock", { filled: 3, segments: 8, direction: "doom", visibility: "explicit" }],
    ["continuity-engine.knowledge", { partyBelief: "It was an accident", source: "Innkeeper", revealedSession: 2, reliability: "lie", partyKnows: true }],
    ["continuity-engine.session", { recap: "<p>They fled the city.</p>", events: [{ text: SECRET }] }],
  ];

  it.each(cases)("%s copy contains none of the GM-only fields", async (type, system) => {
    await publish.syncPublishedCopy(source(type, system));
    expect(JSON.stringify(lastCopy().data)).not.toContain(SECRET);
  });

  it("a thread copy has only status and stakes (no pressure number)", async () => {
    await publish.syncPublishedCopy(
      source("continuity-engine.thread", { status: "open", stakes: "The city", pressure: 9, playerVisible: true }),
    );
    expect(lastCopy().data.system).toEqual({ status: "open", stakes: "The city" });
  });

  it("a beat copy has only the character and the hook", async () => {
    world.documents.set("Actor.1", { ownership: { default: 0 } });
    await publish.syncPublishedCopy(
      source("continuity-engine.beat", { actor: "Actor.1", hook: "A debt", playerVisible: true, debt: 9 }),
    );
    expect(lastCopy().data.system).toEqual({ actor: "Actor.1", hook: "A debt" });
  });

  it("a session copy has only the recap", async () => {
    await publish.syncPublishedCopy(source("continuity-engine.session", { recap: "<p>They fled.</p>" }));
    expect(lastCopy().data.system).toEqual({ recap: "<p>They fled.</p>" });
  });
});

describe("what decides whether something is published", () => {
  it.each([
    ["continuity-engine.thread", { status: "open", stakes: "", playerVisible: false }],
    ["continuity-engine.faction", { disposition: 10, currentMove: "", playerVisible: false }],
    ["continuity-engine.clock", { filled: 1, segments: 4, direction: "doom", visibility: "hidden" }],
    ["continuity-engine.knowledge", { partyBelief: "x", source: "", revealedSession: null, reliability: "confirmed", partyKnows: false }],
    ["continuity-engine.session", { recap: "<p></p>" }],
    ["continuity-engine.beat", { actor: "Actor.1", hook: "h", playerVisible: false }],
    ["continuity-engine.beat", { actor: "", hook: "h", playerVisible: true }],
  ])("%s is kept private: %j", async (type, system) => {
    await publish.syncPublishedCopy(source(type, system));
    expect(world.createdPages).toHaveLength(0);
  });

  it("ignores page types it does not know", async () => {
    await publish.syncPublishedCopy(source("some-other-module.thing", { playerVisible: true }));
    expect(world.createdPages).toHaveLength(0);
  });
});

describe("clocks", () => {
  it("an explicit clock shows the real numbers", async () => {
    await publish.syncPublishedCopy(
      source("continuity-engine.clock", { filled: 3, segments: 8, direction: "doom", visibility: "explicit" }),
    );
    expect(lastCopy().data.system).toEqual({ filled: 3, segments: 8, direction: "doom", visibility: "explicit" });
  });

  // A vague clock shows a band only, drawn as a 4-segment clock. The real
  // count must not be recoverable from the copy's data.
  it.each([
    [1, 8, 1],
    [3, 8, 2],
    [5, 8, 2],
    [6, 8, 3],
    [7, 8, 3],
    [8, 8, 4],
  ])("a vague clock at %s of %s is published as %s of 4", async (filled, segments, shown) => {
    await publish.syncPublishedCopy(
      source("continuity-engine.clock", { filled, segments, direction: "doom", visibility: "vague" }),
    );
    expect(lastCopy().data.system).toEqual({ filled: shown, segments: 4, direction: "doom", visibility: "vague" });
  });

  it("a vague clock with 12 segments never exposes the 12", async () => {
    await publish.syncPublishedCopy(
      source("continuity-engine.clock", { filled: 5, segments: 12, direction: "doom", visibility: "vague" }),
    );
    const system = lastCopy().data.system as Record<string, unknown>;
    expect(system.segments).toBe(4);
    expect(JSON.stringify(system)).not.toContain("12");
  });
});

describe("factions", () => {
  it.each([37, -37, 1, -1, 100, -100, 0])(
    "disposition %s is published as a stand-in that gives the same band but not the true number",
    async (disposition) => {
      await publish.syncPublishedCopy(
        source("continuity-engine.faction", { disposition, currentMove: "Recruiting", playerVisible: true }),
      );
      const system = lastCopy().data.system as { disposition: number; currentMove: string };
      expect(Object.keys(system).sort()).toEqual(["currentMove", "disposition"]);
      expect(dispositionBand(system.disposition)).toBe(dispositionBand(disposition));
      if (disposition % 20 !== 0) expect(system.disposition).not.toBe(disposition);
    },
  );
});

describe("knowledge", () => {
  it("a lie is shown to players as an ordinary rumour", async () => {
    await publish.syncPublishedCopy(
      source("continuity-engine.knowledge", {
        partyBelief: "It was an accident",
        source: "Innkeeper",
        revealedSession: 2,
        reliability: "lie",
        partyKnows: true,
      }),
    );
    const system = lastCopy().data.system as { reliability: string };
    expect(system.reliability).toBe("rumour");
    expect(JSON.stringify(lastCopy().data)).not.toContain('"lie"');
  });

  it.each(["confirmed", "corroborated", "rumour"])("%s is passed through unchanged", async (reliability) => {
    await publish.syncPublishedCopy(
      source("continuity-engine.knowledge", {
        partyBelief: "x",
        source: "s",
        revealedSession: 1,
        reliability,
        partyKnows: true,
      }),
    );
    expect((lastCopy().data.system as { reliability: string }).reliability).toBe(reliability);
  });
});

describe("who can see a copy", () => {
  it("party-wide pages are readable by every player", async () => {
    await publish.syncPublishedCopy(
      source("continuity-engine.thread", { status: "open", stakes: "x", playerVisible: true }),
    );
    expect(lastCopy().data.ownership).toEqual({ default: OWNERSHIP.OBSERVER });
  });

  it("a beat is visible only to the player who owns that character", async () => {
    world.users.push(
      { id: "gm", isGM: true },
      { id: "owner", isGM: false },
      { id: "other", isGM: false },
    );
    world.documents.set("Actor.pc", { ownership: { default: OWNERSHIP.NONE, owner: OWNERSHIP.OWNER, other: OWNERSHIP.OBSERVER, gm: OWNERSHIP.OWNER } });

    await publish.syncPublishedCopy(
      source("continuity-engine.beat", { actor: "Actor.pc", hook: "A debt", playerVisible: true }),
    );

    expect(lastCopy().data.ownership).toEqual({ default: OWNERSHIP.NONE, owner: OWNERSHIP.OBSERVER });
  });

  it("a beat is hidden from everyone if the character cannot be found", async () => {
    world.users.push({ id: "owner", isGM: false });
    await publish.syncPublishedCopy(
      source("continuity-engine.beat", { actor: "Actor.missing", hook: "A debt", playerVisible: true }),
    );
    expect(lastCopy().data.ownership).toEqual({ default: OWNERSHIP.NONE });
  });

  it("a beat goes to every player when the whole table owns the character", async () => {
    world.users.push({ id: "a", isGM: false }, { id: "b", isGM: false });
    world.documents.set("Actor.shared", { ownership: { default: OWNERSHIP.OWNER } });
    await publish.syncPublishedCopy(
      source("continuity-engine.beat", { actor: "Actor.shared", hook: "h", playerVisible: true }),
    );
    expect(lastCopy().data.ownership).toEqual({ default: OWNERSHIP.NONE, a: OWNERSHIP.OBSERVER, b: OWNERSHIP.OBSERVER });
  });
});

describe("keeping the copy in step with its source", () => {
  it("creates the copy in a shared journal and links the two pages", async () => {
    const page = source("continuity-engine.thread", { status: "open", stakes: "x", playerVisible: true }, "Dragon");
    await publish.syncPublishedCopy(page);

    const created = lastCopy();
    expect(created.options).toEqual({ parent: world.journals[0] });
    expect(created.data.name).toBe("Dragon");
    expect(created.data.flags).toEqual({ "continuity-engine": { isPublishedCopy: true, sourceUuid: page.uuid } });
    expect(page.flags.publishedUuid).toBe(created.uuid);
    expect(world.createdJournals).toEqual([{ name: "Continuity — Published", ownership: { default: OWNERSHIP.OBSERVER } }]);
  });

  it("reuses one published journal for many pages", async () => {
    await publish.syncPublishedCopy(source("continuity-engine.thread", { status: "open", stakes: "a", playerVisible: true }));
    await publish.syncPublishedCopy(source("continuity-engine.thread", { status: "open", stakes: "b", playerVisible: true }));
    expect(world.createdJournals).toHaveLength(1);
    expect(world.createdPages).toHaveLength(2);
  });

  it("saving again updates the existing copy instead of making a second one", async () => {
    const page = source("continuity-engine.thread", { status: "open", stakes: "v1", playerVisible: true });
    await publish.syncPublishedCopy(page);
    const copy = world.documents.get(lastCopy().uuid) as FakePage;

    page.system.stakes = "v2";
    await publish.syncPublishedCopy(page);

    expect(world.createdPages).toHaveLength(1);
    expect(copy.update).toHaveBeenCalledWith({
      name: page.name,
      system: { status: "open", stakes: "v2" },
      ownership: { default: OWNERSHIP.OBSERVER },
    });
  });

  it("unticking player-visible deletes the copy and clears the link", async () => {
    const page = source("continuity-engine.thread", { status: "open", stakes: "x", playerVisible: true });
    await publish.syncPublishedCopy(page);
    const copy = world.documents.get(lastCopy().uuid) as FakePage;

    page.system.playerVisible = false;
    await publish.syncPublishedCopy(page);

    expect(copy.delete).toHaveBeenCalledTimes(1);
    expect(page.flags.publishedUuid).toBeUndefined();
  });

  it("makes a fresh copy if the old one was deleted behind its back", async () => {
    const page = source("continuity-engine.thread", { status: "open", stakes: "x", playerVisible: true });
    page.flags.publishedUuid = "JournalEntry.gone.JournalEntryPage.gone";
    await publish.syncPublishedCopy(page);
    expect(world.createdPages).toHaveLength(1);
    expect(page.flags.publishedUuid).toBe(lastCopy().uuid);
  });
});

describe("registerPublishSync (the hooks that run it)", () => {
  beforeEach(() => {
    publish.registerPublishSync();
  });

  it("publishes when a page is created or updated", async () => {
    const page = source("continuity-engine.thread", { status: "open", stakes: "x", playerVisible: true });
    await world.fire("createJournalEntryPage", page);
    await flush();
    expect(world.createdPages).toHaveLength(1);
  });

  it("never re-publishes a published copy from its own save", async () => {
    const copy = makePage({
      type: "continuity-engine.thread",
      system: { status: "open", stakes: "x", playerVisible: true },
      flags: { isPublishedCopy: true },
    });
    await world.fire("updateJournalEntryPage", copy);
    await flush();
    expect(world.createdPages).toHaveLength(0);
  });

  it("deleting a source page deletes its published copy (no orphans left for players to read)", async () => {
    const page = source("continuity-engine.faction", { disposition: 40, currentMove: "x", playerVisible: true });
    await publish.syncPublishedCopy(page);
    const copy = world.documents.get(lastCopy().uuid) as FakePage;

    await world.fire("deleteJournalEntryPage", page);
    await flush();

    expect(copy.delete).toHaveBeenCalledTimes(1);
  });

  it("deleting a published copy triggers nothing further", async () => {
    const copy = makePage({ flags: { isPublishedCopy: true, publishedUuid: "x" } });
    await world.fire("deleteJournalEntryPage", copy);
    await flush();
    expect(world.createdPages).toHaveLength(0);
  });
});
