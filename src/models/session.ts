const fields = foundry.data.fields;

function sessionSchema() {
  return {
    number: new fields.NumberField({
      required: true,
      integer: true,
      initial: 0,
      label: "Session Number",
      placeholder: "12",
    }),
    date: new fields.StringField({
      required: true,
      blank: true,
      label: "Date",
      hint: "Real-world date.",
      placeholder: "March 3rd",
    }),
    present: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Present",
      hint: "Which PCs were at the table. Editable via the Cockpit (P2).",
    }),
    events: new fields.ArrayField(
      new fields.SchemaField({
        timestamp: new fields.StringField({ required: true, blank: true }),
        kind: new fields.StringField({ required: true, blank: true }),
        text: new fields.StringField({ required: true, blank: true }),
        refs: new fields.ArrayField(new fields.DocumentUUIDField()),
      }),
      {
        label: "Events",
        hint: "Timestamped event log. Editable via the Cockpit (P2).",
      },
    ),
    threadsTouched: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Threads Touched",
      hint: "Editable via the Cockpit (P2).",
    }),
    clocksAdvanced: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Clocks Advanced",
      hint: "Editable via the Cockpit (P2).",
    }),
    recap: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Recap",
      hint: "Player-facing — this is the page players can read.",
      placeholder:
        "The party found the reeve's body in the mill race and confronted the bailiff, who lied about a trip to the capital.",
    }),
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
