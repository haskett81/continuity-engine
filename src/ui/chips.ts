import { i18n } from "../foundry-utils.js";
import { getLedger } from "../state/ledger.js";

export type ChipTone = "neutral" | "warn" | "alert" | "positive" | "negative";

export interface Chip {
  text: string;
  tone: ChipTone;
}

/** Sheet UX spec §1.5 chip table — shared conditions used by more than one page type, and by the Cockpit. */
export function staleChip(staleness: number): Chip | null {
  const threshold = (getLedger().config as { staleThreshold: number }).staleThreshold;
  if (staleness < threshold) return null;
  return { text: i18n().format("CE.common.staleChip", { n: String(staleness) }), tone: "warn" };
}

export function overdueChip(debt: number): Chip | null {
  const threshold = (getLedger().config as { beatDebtThreshold: number }).beatDebtThreshold;
  if (debt < threshold) return null;
  return { text: i18n().format("CE.beat.chip.overdue", { n: String(debt) }), tone: "warn" };
}

export function clockFillChip(filled: number, segments: number): Chip | null {
  if (filled >= segments) return { text: i18n().localize("CE.clock.chip.filled"), tone: "alert" };
  if (filled === segments - 1) return { text: i18n().localize("CE.clock.chip.nearlyFull"), tone: "warn" };
  return null;
}

export function divergentChip(divergent: boolean): Chip | null {
  return divergent ? { text: i18n().localize("CE.knowledge.chip.divergent"), tone: "warn" } : null;
}
