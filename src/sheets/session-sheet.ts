import { ContinuityPageSheet, dropListContext } from "./base-sheet.js";
import { type Chip } from "../ui/chips.js";
import { i18n } from "../foundry-utils.js";

interface SessionSystemLike {
  number: number;
  date: string;
  isCurrent: boolean;
  attendees: string[];
  recap: string;
  gmNotes: string;
}

export class SessionSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/session-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as SessionSystemLike;

    const chips: Chip[] = [];
    if (system.isCurrent) chips.push({ text: i18n().localize("CE.session.chip.current"), tone: "neutral" });

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      namePlaceholder: i18n().format("CE.session.namePlaceholder", {
        number: String(system.number),
        date: system.date || i18n().localize("CE.session.dateTbd"),
      }),
      attendees: await dropListContext({
        field: "system.attendees",
        labelKey: "CE.session.attendees.label",
        emptyTextKey: "CE.session.attendees.empty",
        uuids: system.attendees,
      }),
    };
  }
}
