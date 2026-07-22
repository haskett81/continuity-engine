import { ContinuityPageSheet, dropSlotContext, sessionFieldContext } from "./base-sheet.js";
import { type Chip, type ChipTone } from "../ui/chips.js";
import { i18n } from "../foundry-utils.js";

interface FactionSystemLike {
  disposition: number;
  face: string;
  agenda: string;
  currentMove: string;
  lastContact: number | null;
  playerVisible: boolean;
  dispositionBand: string;
}

const LEGEND_KEYS = [
  "hated",
  "factionSchemes",
  "enemies",
  "hostile",
  "unfriendly",
  "neutral",
  "friendly",
  "allied",
  "loyal",
  "factionBoons",
  "trusted",
];

function dispositionTone(disposition: number): ChipTone {
  if (disposition > 0) return "positive";
  if (disposition < 0) return "negative";
  return "neutral";
}

export class FactionSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/faction-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as FactionSystemLike;
    const bandLabel = i18n().localize(`CE.faction.disposition.band.${system.dispositionBand}`);

    const chips: Chip[] = [{ text: bandLabel, tone: dispositionTone(system.disposition) }];

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      legend: LEGEND_KEYS.map((key) => ({
        label: i18n().localize(`CE.faction.disposition.band.${key}`),
        active: key === system.dispositionBand,
      })),
      face: await dropSlotContext({
        field: "system.face",
        labelKey: "CE.faction.face.label",
        emptyTextKey: "CE.faction.face.empty",
        uuid: system.face,
      }),
      lastContact: sessionFieldContext({
        name: "system.lastContact",
        labelKey: "CE.faction.lastContact.label",
        hintKey: "CE.faction.lastContact.hint",
        value: system.lastContact,
      }),
    };
  }
}
