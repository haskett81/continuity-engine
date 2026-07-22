import { pagesOfType } from "./pages.js";

// Bumped whenever a migration below is added. Field/enum-shape migrations
// (old value no longer in a field's `choices`, or a field didn't exist
// before) live in each model's `static migrateData(source)` instead — those
// run on every load and are safe to run unconditionally. This module is only
// for migrations that are numerically or structurally ambiguous and must run
// exactly once (see docs/continuity-engine-sheet-ux-spec.md §4 and the
// Migration section of the implementing plan).
const SCHEMA_VERSION = 1;

// Same third-party-settings-typing gap as state/ledger.ts — see the comment
// there for why this is cast narrowly instead of declaration-merged.
type UntypedSettings = {
  register: (namespace: string, key: string, data: Record<string, unknown>) => void;
  get: (namespace: string, key: string) => unknown;
  set: (namespace: string, key: string, value: unknown) => Promise<unknown>;
};

function getSettings(): UntypedSettings {
  return (game as unknown as { settings: UntypedSettings }).settings;
}

export function registerSchemaVersionSetting(): void {
  getSettings().register("continuity-engine", "schemaVersion", {
    name: "Continuity Schema Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
}

interface FactionSystemLike {
  disposition: number;
}

/**
 * Faction disposition's -5..+5 -> -100..+100 rescale (spec §2.2's migration
 * note) can't be a `migrateData` field guess: an old value of 3 and a
 * legitimate new-range value of 3 are indistinguishable in isolation. The
 * new schema's -100..100 range is a superset of the old -5..5 one, so old
 * data doesn't fail validation before this runs — it just reads on the wrong
 * scale until `ready` fires and this batch corrects it, once, permanently.
 */
async function migrateFactionDisposition(): Promise<void> {
  const factionPages = pagesOfType("continuity-engine.faction");
  await Promise.all(
    factionPages.map((page) => {
      const disposition = (page.system as FactionSystemLike).disposition;
      return page.update({ "system.disposition": disposition * 20 });
    }),
  );
}

/**
 * Runs once per world. Call from the `ready` hook — must be registered via
 * registerSchemaVersionSetting() in `init` first.
 */
export async function runMigrations(): Promise<void> {
  const settings = getSettings();
  const stored = settings.get("continuity-engine", "schemaVersion") as number;
  if (stored >= SCHEMA_VERSION) return;

  if (stored < 1) {
    await migrateFactionDisposition();
  }

  await settings.set("continuity-engine", "schemaVersion", SCHEMA_VERSION);
}
