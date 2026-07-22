import { pagesOfType } from "../../../state/pages.js";
import { i18n } from "../../../foundry-utils.js";
import { stripHtml, truncate } from "../../../ui/text.js";
import type { ChipTone } from "../../../ui/chips.js";

interface FactionSystemLike {
  disposition: number;
  dispositionBand: string;
  currentMove: string;
  clocks: string[];
}

function dispositionTone(disposition: number): ChipTone {
  if (disposition > 0) return "positive";
  if (disposition < 0) return "negative";
  return "neutral";
}

async function resolveNames(uuids: string[]): Promise<Array<{ uuid: string; name: string }>> {
  const docs = await Promise.all(
    uuids.map(async (uuid) => {
      const doc = (await fromUuid(uuid)) as { name?: string } | null;
      return doc ? { uuid, name: doc.name ?? uuid } : null;
    }),
  );
  return docs.filter((d): d is { uuid: string; name: string } => d !== null);
}

export async function prepareFactionsContext(): Promise<Record<string, unknown>> {
  const pages = pagesOfType("continuity-engine.faction");

  const factions = await Promise.all(
    pages.map(async (p) => {
      const system = p.system as FactionSystemLike;
      return {
        uuid: p.uuid,
        name: p.name,
        disposition: system.disposition,
        dispositionBandLabel: i18n().localize(`CE.faction.disposition.band.${system.dispositionBand}`),
        dispositionTone: dispositionTone(system.disposition),
        currentMovePreview: truncate(stripHtml(system.currentMove), 80),
        clocks: await resolveNames(system.clocks),
      };
    }),
  );

  return { factions };
}
