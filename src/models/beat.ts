const fields = foundry.data.fields;

function beatSchema() {
  return {
    actor: new fields.DocumentUUIDField({ required: true }),
    hook: new fields.HTMLField({ required: true, blank: true }),
    lastServedSession: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    stage: new fields.StringField({
      required: true,
      initial: "seeded",
      choices: { seeded: "Seeded", building: "Building", crisis: "Crisis", resolved: "Resolved" },
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

  // `debt` derived field deferred to P1 (spec §4.6).
}
