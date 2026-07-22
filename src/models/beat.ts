import { beatDebt } from "../derive/beat.js";
import { getCurrentSession } from "../state/session.js";

const fields = foundry.data.fields;

function beatSchema() {
  return {
    actor: new fields.DocumentUUIDField({ required: true, blank: true, initial: "" }),
    hook: new fields.HTMLField({ required: true, blank: true }),
    lastServedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
    }),
    stage: new fields.StringField({
      required: true,
      initial: "seeded",
      choices: ["seeded", "surfaced", "escalating", "resolved"],
    }),
    playerVisible: new fields.BooleanField({ required: true, initial: false }),
  };
}

export class BeatModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof beatSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof beatSchema> {
    return beatSchema();
  }

  // UX spec §6.3 locks in a new stage ladder (seeded/surfaced/escalating/
  // resolved) replacing the old (seeded/building/crisis/resolved). Runs on
  // every load; idempotent since a migrated value never matches the old one
  // again.
  static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
    if (source.stage === "building") source.stage = "surfaced";
    else if (source.stage === "crisis") source.stage = "escalating";
    return super.migrateData(source);
  }

  declare debt: number;

  override prepareDerivedData(): void {
    this.debt = beatDebt(this.lastServedSession, getCurrentSession());
  }
}
