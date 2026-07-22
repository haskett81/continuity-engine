import { ContinuityPageSheet, sessionFieldContext } from "./base-sheet.js";
import { divergentChip, type Chip } from "../ui/chips.js";
import { i18n } from "../foundry-utils.js";

interface KnowledgeSystemLike {
  truth: string;
  partyBelief: string;
  partyKnows: boolean;
  revealedSession: number | null;
  source: string;
  reliability: string;
  divergent: boolean;
}

const RELIABILITY_KEYS = ["confirmed", "corroborated", "rumour", "lie"];

export class KnowledgeSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/knowledge-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as KnowledgeSystemLike;

    const chips: Chip[] = [
      { text: i18n().localize(`CE.knowledge.reliability.${system.reliability}`), tone: "neutral" },
    ];
    const divergent = divergentChip(system.divergent);
    if (divergent) chips.push(divergent);
    chips.push(
      system.partyKnows
        ? { text: i18n().format("CE.knowledge.chip.knownSince", { session: String(system.revealedSession ?? "?") }), tone: "neutral" }
        : { text: i18n().localize("CE.knowledge.chip.unknown"), tone: "neutral" },
    );

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      groupDisabled: !system.partyKnows,
      reliabilityChoices: Object.fromEntries(
        RELIABILITY_KEYS.map((key) => [key, i18n().localize(`CE.knowledge.reliability.${key}`)]),
      ),
      revealedSession: sessionFieldContext({
        name: "system.revealedSession",
        labelKey: "CE.knowledge.revealedSession.label",
        hintKey: "CE.knowledge.revealedSession.hint",
        value: system.revealedSession,
        disabled: !system.partyKnows,
      }),
    };
  }
}
