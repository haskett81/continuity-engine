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
    }),
    filled: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0,
    }),
    direction: new fields.StringField({
      required: true,
      initial: "progress",
      choices: { doom: "Doom", progress: "Progress" },
    }),
    trigger: new fields.HTMLField({ required: true, blank: true }),
    owner: new fields.DocumentUUIDField({ required: false, nullable: true, initial: null }),
    visibility: new fields.StringField({
      required: true,
      initial: "hidden",
      choices: { hidden: "Hidden", vague: "Vague", explicit: "Explicit" },
    }),
    lastAdvancedSession: new fields.NumberField({ required: true, integer: true, initial: 0 }),
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
