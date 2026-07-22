import { clockStatus } from "../derive/clock.js";

const fields = foundry.data.fields;

function clockSchema() {
  return {
    segments: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      min: 2,
      initial: 4,
      label: "Segments",
      hint: "Total slices in the clock.",
      placeholder: "6",
    }),
    filled: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
      label: "Filled",
      hint: "How many segments are filled in right now. One segment left flags this clock on the Cockpit Board.",
      placeholder: "2",
    }),
    direction: new fields.StringField({
      required: true,
      initial: "progress",
      choices: { doom: "Doom", progress: "Progress" },
      label: "Direction",
      hint: "Doom clocks are bad for the party when they fill; Progress clocks are good.",
    }),
    trigger: new fields.HTMLField({
      required: true,
      blank: true,
      label: "When It Fills",
      hint: "What fires when it completes. GM-only.",
      placeholder: "The bailiff controls the town's food; the party's leverage is gone.",
    }),
    owner: new fields.DocumentUUIDField({
      required: false,
      nullable: true,
      initial: null,
      label: "Owner",
      hint: "Usually a Faction page. Editable via the Cockpit (P2).",
    }),
    visibility: new fields.StringField({
      required: true,
      initial: "hidden",
      choices: { hidden: "Hidden", vague: "Vague", explicit: "Explicit" },
      label: "Visibility",
      hint: "Controls what players see. Vague shows a qualitative band instead of the exact count.",
    }),
    lastAdvancedSession: new fields.NumberField({
      required: true,
      integer: true,
      initial: 0,
      label: "Last Advanced (Session #)",
      placeholder: "9",
    }),
  };
}

export class ClockModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof clockSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof clockSchema> {
    return clockSchema();
  }

  declare complete: boolean;
  declare remaining: number;
  declare percent: number;

  override prepareDerivedData(): void {
    Object.assign(this, clockStatus(this.filled, this.segments));
  }
}
