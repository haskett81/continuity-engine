import { ContinuityPageSheet, dropSlotContext, sessionFieldContext, clockFillChip, i18n, type Chip } from "./base-sheet.js";

interface ClockSystemLike {
  segments: number;
  filled: number;
  direction: string;
  trigger: string;
  owner: string | null;
  visibility: string;
  lastAdvancedSession: number;
  complete: boolean;
  remaining: number;
  percent: number;
}

const DIAL_RADIUS = 40;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function dialGeometry(percent: number, direction: string) {
  return {
    radius: DIAL_RADIUS,
    circumference: DIAL_CIRCUMFERENCE,
    dashOffset: DIAL_CIRCUMFERENCE * (1 - percent / 100),
    doom: direction === "doom",
  };
}

export class ClockSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/clock-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as ClockSystemLike;

    const chips: Chip[] = [
      { text: i18n().localize(`CE.clock.chip.${system.direction}`), tone: "neutral" },
      {
        text: i18n().format("CE.clock.chip.fraction", { filled: String(system.filled), segments: String(system.segments) }),
        tone: "neutral",
      },
    ];
    const fillChip = clockFillChip(system.filled, system.segments);
    if (fillChip) chips.push(fillChip);

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      dial: dialGeometry(system.percent, system.direction),
      owner: await dropSlotContext({
        field: "system.owner",
        labelKey: "CE.clock.owner.label",
        emptyTextKey: "CE.clock.owner.empty",
        uuid: system.owner ?? "",
      }),
      lastAdvancedSession: sessionFieldContext({
        name: "system.lastAdvancedSession",
        labelKey: "CE.clock.lastAdvancedSession.label",
        hintKey: "CE.clock.lastAdvancedSession.hint",
        value: system.lastAdvancedSession,
      }),
    };
  }
}
