import { divergent } from "../derive/divergence.js";

const fields = foundry.data.fields;

function knowledgeSchema() {
  return {
    truth: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Truth (GM only)",
      hint: "What is actually true. Never shown to players.",
      placeholder: "The reeve died three nights ago; the bailiff is hiding it to hold the granary.",
    }),
    partyBelief: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Party Belief",
      hint: "What the party currently thinks — may be wrong, partial, or planted.",
      placeholder: "The reeve rode to the capital and returns by the feast.",
    }),
    knownBy: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Known By",
      hint: "Which PCs know this. Editable via the Cockpit (P2).",
    }),
    revealedSession: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
      label: "Revealed (Session #)",
      hint: "Session the party learned this. Blank = they don't know yet.",
      placeholder: "12",
    }),
    source: new fields.StringField({
      required: true,
      blank: true,
      label: "Source",
      hint: "Who or what told them.",
      placeholder: "The bailiff's testimony / a note in the mill / tavern gossip",
    }),
    reliability: new fields.StringField({
      required: true,
      initial: "rumor",
      choices: { confirmed: "Confirmed", plausible: "Plausible", rumor: "Rumor", lie: "Lie" },
      label: "Reliability",
      hint: "How trustworthy the belief is. Rumor or Lie flags this page as divergent on the Cockpit Board.",
    }),
    relatedThreads: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Related Threads",
      hint: "Linked Thread pages. Editable via the Cockpit (P2).",
    }),
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
