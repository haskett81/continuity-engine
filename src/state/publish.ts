// P4: the sanitized-copy publish architecture (design book, superseding an
// earlier plan to toggle native ownership on the source page directly — that
// approach can't split a document's fields, which is exactly the problem
// Session's recap-vs-event-log tension exposed). The rule this exists to
// hold: no GM-only field ever exists on a document a player has permission to
// read. So the GM's source page never becomes player-readable, ever — instead,
// ticking "Player Visible" writes a separate, sanitized copy into its own
// journal, re-synced every time the source saves. Only the copy is ever
// player-readable, and only the copy's own (type-specific) safe field subset
// exists on it.
//
// Beat is the first (and, as of this writing, only) type wired all the way
// through — proven end-to-end live before the other five get the same
// treatment, per this project's established practice of not building all six
// at once on an unproven pattern.
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

/**
 * Type-specific safe-field subsets. Only what's listed here ever reaches a
 * player's client. Beat deliberately omits `stage`/`lastServedSession`/
 * `debt` — GM pacing mechanics, not something spec or the design book's
 * "Mine" tab ever shows a player.
 */
function sanitize(type: string, system: Record<string, unknown>): Record<string, unknown> | null {
  if (type === "continuity-engine.beat") {
    const s = system as unknown as BeatSystemLike;
    return { actor: s.actor, hook: s.hook };
  }
  return null;
}

function shouldPublish(type: string, system: Record<string, unknown>): boolean {
  if (type === "continuity-engine.beat") {
    const s = system as unknown as BeatSystemLike;
    return s.playerVisible && !!s.actor;
  }
  return false;
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

/** Per-type ownership shape for a freshly-published copy, beyond the shared `default: NONE` baseline. */
async function ownershipFor(type: string, system: Record<string, unknown>): Promise<Record<string, number>> {
  const ownership: Record<string, number> = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };

  if (type === "continuity-engine.beat") {
    const s = system as unknown as BeatSystemLike;
    const ownerIds = await resolveOwnerUserIds(s.actor);
    for (const id of ownerIds) ownership[id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  }
  // Other five types (once wired): default: OBSERVER for all players, no
  // per-user narrowing — only Beat is personal.

  return ownership;
}

/**
 * Runs on every save of a source page. No-op for types not yet in
 * `sanitize()`'s table — that's how "prove it on Beat first" stays true in
 * code, not just in sequencing.
 */
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
