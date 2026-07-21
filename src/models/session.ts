const fields = foundry.data.fields;

function sessionSchema() {
  return {
    number: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    date: new fields.StringField({ required: true, blank: true }),
    present: new fields.ArrayField(new fields.DocumentUUIDField()),
    events: new fields.ArrayField(
      new fields.SchemaField({
        timestamp: new fields.StringField({ required: true, blank: true }),
        kind: new fields.StringField({ required: true, blank: true }),
        text: new fields.StringField({ required: true, blank: true }),
        refs: new fields.ArrayField(new fields.DocumentUUIDField()),
      }),
    ),
    threadsTouched: new fields.ArrayField(new fields.DocumentUUIDField()),
    clocksAdvanced: new fields.ArrayField(new fields.DocumentUUIDField()),
    recap: new fields.HTMLField({ required: true, blank: true }),
  };
}

export class SessionModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof sessionSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof sessionSchema> {
    return sessionSchema();
  }
}
