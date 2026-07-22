import { staleness } from "../derive/staleness.js";
import { getLedger } from "../state/ledger.js";

const fields = foundry.data.fields;

function threadSchema() {
  return {
    status: new fields.StringField({
      required: true,
      initial: "open",
      choices: { open: "Open", dormant: "Dormant", resolved: "Resolved", abandoned: "Abandoned" },
      label: "Status",
    }),
    stakes: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Stakes",
      hint: "What happens if nobody acts.",
      placeholder: "Who killed the reeve, and why is the bailiff covering it?",
    }),
    pressure: new fields.NumberField({
      required: true,
      integer: true,
      initial: 0,
      min: 0,
      max: 10,
      label: "Pressure",
      hint: "0–10, how loud this is right now. Drives sort order.",
      placeholder: "6",
    }),
    openedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      label: "Opened (Session #)",
      placeholder: "9",
    }),
    lastTouchedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      label: "Last Touched (Session #)",
      hint: "How recently this thread was addressed. Falling behind flags it as stale on the Cockpit Board.",
      placeholder: "9",
    }),
    resolvedSession: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
      label: "Resolved (Session #)",
      hint: "Leave blank until the thread closes.",
    }),
    owners: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Owners",
      hint: "Actors whose thread this is. Editable via the Cockpit (P2).",
    }),
    relatedFactions: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Related Factions",
      hint: "Editable via the Cockpit (P2).",
    }),
    playerVisible: new fields.BooleanField({
      required: true,
      initial: false,
      label: "Player Visible",
      hint: "Gates whether this thread appears in the player view.",
    }),
    resolution: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Resolution",
      hint: "Filled in when closed — this is campaign memory.",
      placeholder: "The party confronted the bailiff; the granary reopened, but the reeve's death was never truly resolved.",
    }),
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
