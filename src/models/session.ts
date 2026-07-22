const fields = foundry.data.fields;

function sessionSchema() {
  return {
    number: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    date: new fields.StringField({ required: true, blank: true }),
    isCurrent: new fields.BooleanField({ required: true, initial: false }),
    attendees: new fields.ArrayField(new fields.DocumentUUIDField()),
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
    gmNotes: new fields.HTMLField({ required: true, blank: true }),
  };
}

// "March 3rd" style free text -> ISO yyyy-mm-dd, best-effort. Strips ordinal
// suffixes (Date.parse chokes on "3rd") before attempting a parse; returns
// null rather than guessing when the result isn't a real date.
function parseFreeTextDate(raw: string): string | null {
  const stripped = raw.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const parsed = new Date(stripped);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export class SessionModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof sessionSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof sessionSchema> {
    return sessionSchema();
  }

  // Sheet UX spec §4: `present` (never exposed on the old sheet) is renamed
  // to `attendees` (the new sheet's "In attendance" drop-list); `date` moves
  // from free text to ISO, best-effort parsed, with unparseable text
  // preserved in gmNotes rather than silently dropped. `isCurrent` doesn't
  // need a migrated value here — state/session.ts's getCurrentSession()
  // already falls back to the highest session number when no page is
  // flagged, so old worlds resolve correctly with zero migration needed for
  // that field.
  static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
    if (Array.isArray(source.present) && source.attendees === undefined) {
      source.attendees = source.present;
      delete source.present;
    }

    if (typeof source.date === "string" && source.date.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(source.date)) {
      const parsed = parseFreeTextDate(source.date);
      if (parsed) {
        source.date = parsed;
      } else {
        const existingNotes = typeof source.gmNotes === "string" ? source.gmNotes : "";
        source.gmNotes = `${existingNotes}<p>Date (unparsed): ${source.date}</p>`;
        source.date = "";
      }
    }

    return super.migrateData(source);
  }
}
