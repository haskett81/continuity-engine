import { divergent } from "../derive/divergence.js";

const fields = foundry.data.fields;

function knowledgeSchema() {
  return {
    truth: new fields.HTMLField({ required: true, blank: true }),
    partyBelief: new fields.HTMLField({ required: true, blank: true }),
    knownBy: new fields.ArrayField(new fields.DocumentUUIDField()),
    partyKnows: new fields.BooleanField({ required: true, initial: false }),
    revealedSession: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
    }),
    source: new fields.StringField({ required: true, blank: true }),
    reliability: new fields.StringField({
      required: true,
      initial: "rumour",
      choices: ["confirmed", "corroborated", "rumour", "lie"],
    }),
    relatedThreads: new fields.ArrayField(new fields.DocumentUUIDField()),
  };
}

// Security note (spec §4.4): `truth` must never reach a non-GM client. That is
// enforced by default page ownership + render-context filtering in the
// Cockpit/sheets, not by anything in this schema — that enforcement is P4
// scope ("Permissions + player view"). Do not treat this field as protected
// until that phase lands.
export class KnowledgeModel extends foundry.abstract.TypeDataModel<
  ReturnType<typeof knowledgeSchema>,
  JournalEntryPage
> {
  static defineSchema(): ReturnType<typeof knowledgeSchema> {
    return knowledgeSchema();
  }

  // Sheet UX spec §6.4 locks in a new reliability ladder (confirmed/
  // corroborated/rumour/lie) replacing the old (confirmed/plausible/rumor/
  // lie). Also backfills partyKnows for pre-existing pages, matching spec
  // §4's rule: true where revealed is non-null, else false. Runs on every
  // load; idempotent — a migrated reliability value never matches the old
  // one again, and partyKnows, once present in source, is left alone.
  static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
    if (source.reliability === "plausible") source.reliability = "corroborated";
    else if (source.reliability === "rumor") source.reliability = "rumour";

    if (source.partyKnows === undefined) {
      source.partyKnows = source.revealedSession !== null && source.revealedSession !== undefined;
    }

    return super.migrateData(source);
  }

  declare divergent: boolean;

  override prepareDerivedData(): void {
    // partyBelief is an HTMLField; ProseMirror leaves empty content as markup
    // like "<p></p>" rather than "", so strip tags before the emptiness check.
    const plainBelief = this.partyBelief.replace(/<[^>]*>/g, "");
    this.divergent = divergent(plainBelief, this.reliability);
  }
}
