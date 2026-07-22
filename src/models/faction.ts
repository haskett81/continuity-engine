const fields = foundry.data.fields;

function factionSchema() {
  return {
    disposition: new fields.NumberField({
      required: true,
      integer: true,
      min: -5,
      max: 5,
      initial: 0,
      label: "Disposition",
      hint: "-5 (hostile) to +5 (allied); 0 is neutral.",
      placeholder: "-3",
    }),
    agenda: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Agenda",
      hint: "What they want.",
      placeholder: "Hold the granary; keep the reeve's death buried.",
    }),
    assets: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), {
      label: "Assets",
      hint: "What they can bring to bear. Editable via the Cockpit (P2).",
    }),
    currentMove: new fields.HTMLField({
      required: true,
      blank: true,
      label: "Current Move",
      hint: "What they're doing right now, between sessions.",
      placeholder: "Tightening grain rationing and posting more guards at the mill.",
    }),
    clocks: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Clocks",
      hint: "Linked Clock pages. Editable via the Cockpit (P2).",
    }),
    keyNPCs: new fields.ArrayField(new fields.DocumentUUIDField(), {
      label: "Key NPCs",
      hint: "Notable members. Editable via the Cockpit (P2).",
    }),
    playerVisible: new fields.BooleanField({
      required: true,
      initial: false,
      label: "Player Visible",
      hint: "Do the players even know this faction exists?",
    }),
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
