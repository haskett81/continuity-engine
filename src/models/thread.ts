import { staleness } from "../derive/staleness.js";
import { getLedger } from "../state/ledger.js";

const fields = foundry.data.fields;

function threadSchema() {
  return {
    status: new fields.StringField({
      required: true,
      initial: "open",
      choices: { open: "Open", dormant: "Dormant", resolved: "Resolved", abandoned: "Abandoned" },
    }),
    stakes: new fields.HTMLField({ required: true, blank: true }),
    pressure: new fields.NumberField({
      required: true,
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

  declare staleness: number;

  override prepareDerivedData(): void {
    this.staleness = staleness(this.lastTouchedSession, getLedger().currentSession);
  }
}
