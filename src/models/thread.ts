import { staleness } from "../derive/staleness.js";
import { pressureBand } from "../derive/pressure.js";
import { getCurrentSession } from "../state/session.js";

const fields = foundry.data.fields;

function threadSchema() {
  return {
    status: new fields.StringField({
      required: true,
      initial: "open",
      choices: ["open", "active", "dormant", "resolved"],
    }),
    stakes: new fields.HTMLField({ required: true, blank: true }),
    pressure: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
      max: 10,
    }),
    openedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
    }),
    lastTouchedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
    }),
    resolvedSession: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
    }),
    owners: new fields.ArrayField(new fields.DocumentUUIDField()),
    relatedFactions: new fields.ArrayField(new fields.DocumentUUIDField()),
    playerVisible: new fields.BooleanField({ required: true, initial: false }),
    resolution: new fields.HTMLField({ required: true, blank: true }),
  };
}

export class ThreadModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof threadSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof threadSchema> {
    return threadSchema();
  }

  // UX spec migration: the old status ladder's "abandoned" has no slot in
  // the new one (open/active/dormant/resolved) — closest semantic match,
  // confirmed with Cyrus, is dormant. Runs on every load; idempotent since a
  // migrated value never matches "abandoned" again.
  static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
    if (source.status === "abandoned") {
      source.status = "dormant";
    }
    return super.migrateData(source);
  }

  declare staleness: number;
  declare pressureBand: string;

  override prepareDerivedData(): void {
    this.staleness = staleness(this.lastTouchedSession, getCurrentSession());
    this.pressureBand = pressureBand(this.pressure);
  }
}

interface ThreadPageLike {
  type: string;
  system: { resolvedSession: number | null };
}

interface ThreadUpdateChanges {
  system?: { status?: string; resolvedSession?: number };
}

/**
 * Sheet UX spec §2.1: resolvedSession auto-stamps the current session the
 * moment status flips to resolved. Implemented as a preUpdate hook (not
 * sheet-only JS) so it fires consistently regardless of whether the update
 * comes from this module's sheet or a future Cockpit mutation (P2).
 */
export function onPreUpdateThreadPage(
  document: ThreadPageLike,
  changes: ThreadUpdateChanges,
): void {
  if (document.type !== "continuity-engine.thread") return;
  if (changes.system?.status !== "resolved") return;
  if (document.system.resolvedSession !== null) return;
  if (changes.system.resolvedSession !== undefined) return;

  changes.system.resolvedSession = getCurrentSession();
}
