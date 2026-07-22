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
      choices: ["doom", "progress"],
    }),
    trigger: new fields.HTMLField({ required: true, blank: true }),
    owner: new fields.DocumentUUIDField({ required: false, nullable: true, initial: null }),
    visibility: new fields.StringField({
      required: true,
      initial: "hidden",
      choices: ["hidden", "vague", "explicit"],
    }),
    lastAdvancedSession: new fields.NumberField({
      required: true,
      integer: true,
      initial: 0,
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
    // filled can drift outside [0, segments] via direct document edits
    // (e.g. segments lowered after filled was set); clamp before deriving.
    this.filled = Math.min(Math.max(this.filled, 0), this.segments);
    Object.assign(this, clockStatus(this.filled, this.segments));
  }
}
