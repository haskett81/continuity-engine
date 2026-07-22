import { dispositionBand } from "../derive/disposition.js";

const fields = foundry.data.fields;

function factionSchema() {
  return {
    disposition: new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      min: -100,
      max: 100,
      initial: 0,
    }),
    face: new fields.DocumentUUIDField({ required: true, blank: true, initial: "" }),
    agenda: new fields.HTMLField({ required: true, blank: true }),
    assets: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
    currentMove: new fields.HTMLField({ required: true, blank: true }),
    clocks: new fields.ArrayField(new fields.DocumentUUIDField()),
    keyNPCs: new fields.ArrayField(new fields.DocumentUUIDField()),
    lastContact: new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
    }),
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

  declare dispositionBand: string;

  override prepareDerivedData(): void {
    this.dispositionBand = dispositionBand(this.disposition);
  }
}
