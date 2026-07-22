import { ContinuityPageSheet, dropSlotContext, sessionFieldContext, overdueChip, i18n, type Chip } from "./base-sheet.js";

interface BeatSystemLike {
  actor: string;
  hook: string;
  lastServedSession: number;
  stage: string;
  debt: number;
}

const STAGE_KEYS = ["seeded", "surfaced", "escalating", "resolved"];

export class BeatSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/beat-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as BeatSystemLike;

    const chips: Chip[] = [{ text: i18n().localize(`CE.beat.stage.${system.stage}`), tone: "neutral" }];
    const overdue = overdueChip(system.debt);
    if (overdue) chips.push(overdue);

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      stageChoices: Object.fromEntries(STAGE_KEYS.map((key) => [key, i18n().localize(`CE.beat.stage.${key}`)])),
      character: await dropSlotContext({
        field: "system.actor",
        labelKey: "CE.beat.character.label",
        emptyTextKey: "CE.beat.character.empty",
        uuid: system.actor,
      }),
      lastSpotlightSession: sessionFieldContext({
        name: "system.lastServedSession",
        labelKey: "CE.beat.lastSpotlightSession.label",
        hintKey: "CE.beat.lastSpotlightSession.hint",
        value: system.lastServedSession,
      }),
    };
  }
}
