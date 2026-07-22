import { pagesOfType } from "../../../state/pages.js";
import { divergentChip, type Chip } from "../../../ui/chips.js";
import { i18n } from "../../../foundry-utils.js";
import { stripHtml, truncate } from "../../../ui/text.js";

interface KnowledgeSystemLike {
  truth: string;
  partyBelief: string;
  reliability: string;
  divergent: boolean;
  partyKnows: boolean;
}

export function prepareKnowledgeContext(): Record<string, unknown> {
  const pages = pagesOfType("continuity-engine.knowledge");

  const knowledge = pages.map((p) => {
    const system = p.system as KnowledgeSystemLike;
    const chips: Chip[] = [{ text: i18n().localize(`CE.knowledge.reliability.${system.reliability}`), tone: "neutral" }];
    const divergent = divergentChip(system.divergent);
    if (divergent) chips.push(divergent);

    return {
      uuid: p.uuid,
      name: p.name,
      truthPreview: truncate(stripHtml(system.truth), 80),
      beliefPreview: truncate(stripHtml(system.partyBelief), 80),
      partyKnows: system.partyKnows,
      chips,
    };
  });

  return { knowledge };
}
