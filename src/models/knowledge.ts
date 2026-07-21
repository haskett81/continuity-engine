import { divergent } from "../derive/divergence.js";

const fields = foundry.data.fields;

function knowledgeSchema() {
  return {
    truth: new fields.HTMLField({ required: true, blank: true }),
    partyBelief: new fields.HTMLField({ required: true, blank: true }),
    knownBy: new fields.ArrayField(new fields.DocumentUUIDField()),
    revealedSession: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
    }),
    source: new fields.StringField({ required: true, blank: true }),
    reliability: new fields.StringField({
      required: true,
      initial: "rumor",
      choices: { confirmed: "Confirmed", plausible: "Plausible", rumor: "Rumor", lie: "Lie" },
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

  declare divergent: boolean;

  override prepareDerivedData(): void {
    // partyBelief is an HTMLField; ProseMirror leaves empty content as markup
    // like "<p></p>" rather than "", so strip tags before the emptiness check.
    const plainBelief = this.partyBelief.replace(/<[^>]*>/g, "");
    this.divergent = divergent(plainBelief, this.reliability);
  }
}
