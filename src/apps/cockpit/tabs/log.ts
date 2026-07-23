import { pagesOfType } from "../../../state/pages.js";
import { i18n } from "../../../foundry-utils.js";
import { stripHtml, truncate } from "../../../ui/text.js";

interface SessionSystemLike {
  number: number;
  date: string;
  isCurrent: boolean;
  recap: string;
}

export function prepareLogContext(): Record<string, unknown> {
  const pages = pagesOfType("continuity-engine.session");

  const sessions = pages
    .map((p) => {
      const system = p.system as SessionSystemLike;
      return {
        uuid: p.uuid,
        name: p.name,
        number: system.number,
        date: system.date,
        isCurrent: system.isCurrent,
        recapPreview: truncate(stripHtml(system.recap), 100),
        currentChip: system.isCurrent ? { text: i18n().localize("CE.session.chip.current"), tone: "neutral" as const } : null,
      };
    })
    .sort((a, b) => b.number - a.number);

  const current = sessions.find((s) => s.isCurrent);

  return {
    sessions,
    hasCurrentSession: !!current,
    currentSessionUuid: current?.uuid ?? null,
  };
}
