// P5: export/import a campaign as a compendium Adventure. Spec §"free by
// using native documents": Adventure packing/importing is a core Foundry
// feature this module gets for free by building on real documents — the
// module's actual job is just correct EXPORT (bundle the right documents).
// Import needs zero custom code: verified live, every Adventure document's
// own sheet already has a native "Import Adventure" button.
//
// Deliberately excludes "Continuity — Published" from the bundle — it's
// derived data, not source data. On import, the bundled Ledger/Sessions
// pages carry their real playerVisible/partyKnows/visibility/recap values,
// and state/publish.ts's own createJournalEntryPage hook fires normally for
// each newly-created page during import, which regenerates the published
// journal from scratch. Bundling stale copies of it would be redundant at
// best and inconsistent at worst.
const EXPORT_PACK_NAME = "continuity-engine-export";
const EXPORT_PACK_LABEL = "Continuity Engine — Campaign Export";
const PUBLISHED_JOURNAL_NAME = "Continuity — Published";

const CONTINUITY_TYPES = new Set([
  "continuity-engine.thread",
  "continuity-engine.clock",
  "continuity-engine.faction",
  "continuity-engine.knowledge",
  "continuity-engine.session",
  "continuity-engine.beat",
]);

interface PageLike {
  type: string;
  system: Record<string, unknown>;
}
interface JournalEntryLike {
  name: string;
  pages: { contents: PageLike[] };
  toObject: () => Record<string, unknown>;
}
interface ActorLike {
  toObject: () => Record<string, unknown>;
}
interface CompendiumLike {
  collection: string;
}
interface NotificationsLike {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

function continuityJournals(): JournalEntryLike[] {
  const journal = (game as unknown as { journal: { contents: JournalEntryLike[] } }).journal;
  return journal.contents.filter(
    (j) => j.name !== PUBLISHED_JOURNAL_NAME && j.pages.contents.some((p) => CONTINUITY_TYPES.has(p.type)),
  );
}

/** Beat.actor references need the linked PC actors bundled too, or they resolve to nothing after import into a fresh world. */
function beatActorUuids(journals: JournalEntryLike[]): string[] {
  const uuids = new Set<string>();
  for (const j of journals) {
    for (const p of j.pages.contents) {
      if (p.type === "continuity-engine.beat") {
        const actor = (p.system as { actor?: string }).actor;
        if (actor) uuids.add(actor);
      }
    }
  }
  return [...uuids];
}

async function getOrCreateExportPack(): Promise<CompendiumLike> {
  const packs = (game as unknown as { packs: { get: (id: string) => CompendiumLike | undefined } }).packs;
  const existing = packs.get(`world.${EXPORT_PACK_NAME}`);
  if (existing) return existing;

  const CompendiumClass = CompendiumCollection as unknown as {
    createCompendium: (data: Record<string, unknown>) => Promise<CompendiumLike>;
  };
  return CompendiumClass.createCompendium({ type: "Adventure", label: EXPORT_PACK_LABEL, name: EXPORT_PACK_NAME });
}

export async function exportCampaign(): Promise<void> {
  const journals = continuityJournals();
  if (journals.length === 0) {
    (ui as unknown as { notifications: NotificationsLike }).notifications.warn(
      "Nothing to export — no Continuity Engine pages found in this world.",
    );
    return;
  }

  const actorUuids = beatActorUuids(journals);
  const resolvedActors = (await Promise.all(actorUuids.map((u) => fromUuid(u)))) as unknown as (ActorLike | null)[];
  const actors = resolvedActors.filter((a): a is ActorLike => a !== null);

  const pack = await getOrCreateExportPack();
  const AdventureClass = Adventure as unknown as {
    create: (data: Record<string, unknown>, options: Record<string, unknown>) => Promise<{ name: string } | undefined>;
  };
  const date = new Date().toISOString().slice(0, 10);
  const adventure = await AdventureClass.create(
    {
      name: `Continuity Engine Campaign — ${date}`,
      journal: journals.map((j) => j.toObject()),
      actors: actors.map((a) => a.toObject()),
    },
    { pack: pack.collection },
  );

  (ui as unknown as { notifications: NotificationsLike }).notifications.info(
    adventure
      ? `Exported "${adventure.name}" to the "${EXPORT_PACK_LABEL}" compendium. Open it and use Import Adventure to bring it into another world.`
      : "Export failed — see console.",
  );
}
