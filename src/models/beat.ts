import { beatDebt } from "../derive/beat.js";
import { getLedger } from "../state/ledger.js";

const fields = foundry.data.fields;

function beatSchema() {
  return {
    actor: new fields.DocumentUUIDField({
      required: true,
      label: "PC",
      hint: "Which character this beat is about. Editable via the Cockpit (P2).",
    }),
    hook: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Hook",
      hint: "Their unresolved personal thing.",
      placeholder: "Aldric's brother Cael rides with the bailiff's men — a confrontation is overdue.",
    }),
    lastServedSession: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      label: "Last Spotlight (Session #)",
      hint: "Last time this PC got a scene about them. Falling behind flags this PC on the Cockpit Board.",
      placeholder: "8",
    }),
    stage: new fields.StringField({
      required: true,
      initial: "seeded",
      choices: { seeded: "Seeded", building: "Building", crisis: "Crisis", resolved: "Resolved" },
      label: "Stage",
      hint: "Where this beat is in its arc — Seeded (planted, not yet paid off) through Resolved (paid off).",
    }),
  };
}

export class BeatModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof beatSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof beatSchema> {
    return beatSchema();
  }

  declare debt: number;

  override prepareDerivedData(): void {
    this.debt = beatDebt(this.lastServedSession, getLedger().currentSession);
  }
}
