const fields = foundry.data.fields;

function factionSchema() {
  return {
    disposition: new fields.NumberField({
      required: true,
      integer: true,
      min: -5,
      max: 5,
      initial: 0,
    }),
    agenda: new fields.HTMLField({ required: true, blank: true }),
    assets: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
    currentMove: new fields.HTMLField({ required: true, blank: true }),
    clocks: new fields.ArrayField(new fields.DocumentUUIDField()),
    keyNPCs: new fields.ArrayField(new fields.DocumentUUIDField()),
    playerVisible: new fields.BooleanField({ required: true, initial: false }),
  };
}

export class FactionModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof factionSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof factionSchema> {
    return factionSchema();
  }
}
