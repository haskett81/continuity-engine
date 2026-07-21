const fields = foundry.data.fields;

function clockSchema() {
  return {
    segments: new fields.NumberField({ required: true, integer: true, min: 2, initial: 4 }),
    filled: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    direction: new fields.StringField({
      required: true,
      initial: "progress",
      choices: ["doom", "progress"] as const,
    }),
    trigger: new fields.HTMLField({ required: true, blank: true }),
    owner: new fields.DocumentUUIDField({ required: false, nullable: true, initial: null }),
    visibility: new fields.StringField({
      required: true,
      initial: "hidden",
      choices: ["hidden", "vague", "explicit"] as const,
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

  // complete / remaining / percent are derived in P1 alongside derive/ (spec §4.2).
}
