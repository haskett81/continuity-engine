// P4: the sanitized-copy publish architecture (design book, superseding an
// earlier plan to toggle native ownership on the source page directly — that
// approach can't split a document's fields, which is exactly the problem
// Session's recap-vs-event-log tension exposed). The rule this exists to
// hold: no GM-only field ever exists on a document a player has permission to
// read. So the GM's source page never becomes player-readable, ever — instead,
// a per-type publish gate (see `shouldPublish`) writes a separate, sanitized
// copy into its own journal, re-synced every time the source saves. Only the
// copy is ever player-readable, and only the copy's own (type-specific) safe
// field subset exists on it — never the raw values behind a "vague" or
// "GM-only" label, even in the copy's own unrendered data.
//
// Beat was proven end-to-end live first, alone, before any other type — see
// git history. All six are wired now, on that proven pattern.
import { stripHtml } from "../ui/text.js";
import { clockStatus, clockBand } from "../derive/clock.js";
import { representativeDisposition } from "../derive/disposition.js";

const PUBLISHED_JOURNAL_NAME = "Continuity — Published";
const FLAG_SCOPE = "continuity-engine";

interface JournalEntryLike {
  name: string;
  id: string;
}

interface SourcePageLike {
  uuid: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
  getFlag: (scope: string, key: string) => unknown;
  setFlag: (scope: string, key: string, value: unknown) => Promise<unknown>;
  unsetFlag: (scope: string, key: string) => Promise<unknown>;
}

interface CopyPageLike {
  update: (data: Record<string, unknown>) => Promise<unknown>;
  delete: () => Promise<unknown>;
}

interface ActorLike {
  ownership: Record<string, number>;
}

interface UserLike {
  id: string;
  isGM: boolean;
}

async function getOrCreatePublishedJournal(): Promise<JournalEntryLike> {
  const journal = (game as unknown as { journal: { find: (fn: (j: JournalEntryLike) => boolean) => JournalEntryLike | undefined } }).journal;
  const existing = journal.find((j) => j.name === PUBLISHED_JOURNAL_NAME);
  if (existing) return existing;

  const EntryClass = JournalEntry as unknown as { create: (data: Record<string, unknown>) => Promise<JournalEntryLike> };
  // The journal itself must be broadly visible so players can open it at
  // all — each page's own ownership (independent of the parent, verified
  // live) is what actually narrows who sees which published entries.
  return EntryClass.create({
    name: PUBLISHED_JOURNAL_NAME,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
  });
}

interface BeatSystemLike {
  actor: string;
  hook: string;
  playerVisible: boolean;
}

interface ThreadSystemLike {
  status: string;
  stakes: string;
  playerVisible: boolean;
}

interface FactionSystemLike {
  disposition: number;
  currentMove: string;
  playerVisible: boolean;
}

interface ClockSystemLike {
  filled: number;
  segments: number;
  direction: string;
  visibility: string;
}

interface KnowledgeSystemLike {
  partyBelief: string;
  source: string;
  revealedSession: number | null;
  reliability: string;
  partyKnows: boolean;
}

interface SessionSystemLike {
  recap: string;
}

/** A `lie` never publishes as "lie" — it appears to the party exactly as they believe it: an ordinary unconfirmed rumour, not a flagged falsehood. */
function publishedConfidence(reliability: string): string {
  return reliability === "lie" ? "rumour" : reliability;
}

/**
 * Synthetic 4-segment fraction for a `vague` clock — encodes the correct
 * band and nothing more. The real `filled`/`segments` never touch the copy;
 * a player inspecting the copy's raw data, not just the rendered UI, still
 * can't recover the true count.
 */
const VAGUE_BAND_STEP: Record<string, number> = { justStarting: 1, building: 2, nearlyThere: 3, complete: 4 };

/**
 * Type-specific safe-field subsets. Only what's listed here ever reaches a
 * player's client — never the raw source values for anything not listed.
 */
function sanitize(type: string, system: Record<string, unknown>): Record<string, unknown> | null {
  switch (type) {
    case "continuity-engine.beat": {
      const s = system as unknown as BeatSystemLike;
      return { actor: s.actor, hook: s.hook };
    }
    case "continuity-engine.thread": {
      const s = system as unknown as ThreadSystemLike;
      return { status: s.status, stakes: s.stakes };
    }
    case "continuity-engine.faction": {
      const s = system as unknown as FactionSystemLike;
      // `dispositionBand` is a derived field, not schema — can't be set
      // directly on a copy. Publish a representative `disposition` instead
      // (the band's own boundary value); the copy's own prepareDerivedData
      // re-derives the identical band from it. Never the true number —
      // design book: "no disposition figures on factions ... standing in
      // words" — same reasoning as Thread's pressure omission.
      return { disposition: representativeDisposition(s.disposition), currentMove: s.currentMove };
    }
    case "continuity-engine.clock": {
      const s = system as unknown as ClockSystemLike;
      if (s.visibility === "explicit") {
        return { filled: s.filled, segments: s.segments, direction: s.direction, visibility: s.visibility };
      }
      // vague: publish a synthetic fraction that renders the right band,
      // never the real filled/segments.
      const { percent } = clockStatus(s.filled, s.segments);
      const step = VAGUE_BAND_STEP[clockBand(percent)] ?? 1;
      return { filled: step, segments: 4, direction: s.direction, visibility: s.visibility };
    }
    case "continuity-engine.knowledge": {
      const s = system as unknown as KnowledgeSystemLike;
      return {
        partyBelief: s.partyBelief,
        source: s.source,
        revealedSession: s.revealedSession,
        reliability: publishedConfidence(s.reliability),
      };
    }
    case "continuity-engine.session": {
      const s = system as unknown as SessionSystemLike;
      return { recap: s.recap };
    }
    default:
      return null;
  }
}

function shouldPublish(type: string, system: Record<string, unknown>): boolean {
  switch (type) {
    case "continuity-engine.beat": {
      const s = system as unknown as BeatSystemLike;
      return s.playerVisible && !!s.actor;
    }
    case "continuity-engine.thread": {
      const s = system as unknown as ThreadSystemLike;
      return s.playerVisible;
    }
    case "continuity-engine.faction": {
      const s = system as unknown as FactionSystemLike;
      return s.playerVisible;
    }
    case "continuity-engine.clock": {
      const s = system as unknown as ClockSystemLike;
      return s.visibility !== "hidden";
    }
    case "continuity-engine.knowledge": {
      const s = system as unknown as KnowledgeSystemLike;
      return s.partyKnows;
    }
    case "continuity-engine.session": {
      const s = system as unknown as SessionSystemLike;
      return stripHtml(s.recap ?? "").trim().length > 0;
    }
    default:
      return false;
  }
}

/** Beat's "only you can see this" (design book P4/Mine): resolve which non-GM user(s) actually own the linked PC. */
async function resolveOwnerUserIds(actorUuid: string): Promise<string[]> {
  if (!actorUuid) return [];
  const actor = (await fromUuid(actorUuid)) as ActorLike | null;
  if (!actor) return [];

  const users = (game as unknown as { users: { contents: UserLike[] } }).users.contents;
  return users
    .filter((u) => !u.isGM && (actor.ownership[u.id] ?? actor.ownership.default ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
    .map((u) => u.id);
}

/**
 * Per-type ownership shape for a freshly-published copy, beyond the shared
 * `default: NONE` baseline. Beat is the one personal type — everything else
 * is party-wide (`default: OBSERVER`, every player, no per-user narrowing).
 */
async function ownershipFor(type: string, system: Record<string, unknown>): Promise<Record<string, number>> {
  if (type === "continuity-engine.beat") {
    const ownership: Record<string, number> = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
    const s = system as unknown as BeatSystemLike;
    const ownerIds = await resolveOwnerUserIds(s.actor);
    for (const id of ownerIds) ownership[id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    return ownership;
  }

  return { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
}

/** Runs on every save of a source page. No-op for anything `sanitize()` doesn't recognize. */
export async function syncPublishedCopy(source: SourcePageLike): Promise<void> {
  const sanitized = sanitize(source.type, source.system);
  if (sanitized === null) return;

  const publish = shouldPublish(source.type, source.system);
  const existingUuid = source.getFlag(FLAG_SCOPE, "publishedUuid") as string | undefined;
  const existing = existingUuid ? ((await fromUuid(existingUuid)) as CopyPageLike | null) : null;

  if (!publish) {
    if (existing) await existing.delete();
    if (existingUuid) await source.unsetFlag(FLAG_SCOPE, "publishedUuid");
    return;
  }

  const ownership = await ownershipFor(source.type, source.system);

  if (existing) {
    await existing.update({ name: source.name, system: sanitized, ownership });
    return;
  }

  const journal = await getOrCreatePublishedJournal();
  const PageClass = JournalEntryPage as unknown as {
    create: (data: Record<string, unknown>, options: Record<string, unknown>) => Promise<{ uuid: string } | undefined>;
  };
  const created = await PageClass.create(
    {
      name: source.name,
      type: source.type,
      system: sanitized,
      ownership,
      flags: { [FLAG_SCOPE]: { isPublishedCopy: true, sourceUuid: source.uuid } },
    },
    { parent: journal },
  );
  if (!created) return;
  await source.setFlag(FLAG_SCOPE, "publishedUuid", created.uuid);
}

export function registerPublishSync(): void {
  const handler = (page: SourcePageLike) => {
    if (page.getFlag(FLAG_SCOPE, "isPublishedCopy")) return; // never re-sync a copy off its own save
    void syncPublishedCopy(page);
  };

  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)(
    "updateJournalEntryPage",
    handler as (...args: unknown[]) => unknown,
  );
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)(
    "createJournalEntryPage",
    handler as (...args: unknown[]) => unknown,
  );
}
