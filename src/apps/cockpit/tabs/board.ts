import { getLedger } from "../../../state/ledger.js";
import { pagesOfType } from "../../../state/pages.js";
import { staleChip, overdueChip, divergentChip } from "../../../ui/chips.js";

interface ThreadSystemLike {
  staleness: number;
  status: string;
}
interface ClockSystemLike {
  complete: boolean;
  remaining: number;
}
interface BeatSystemLike {
  debt: number;
  stage: string;
}
interface KnowledgeSystemLike {
  divergent: boolean;
}

export function prepareBoardContext(): Record<string, unknown> {
  const config = getLedger().config as { staleThreshold: number; beatDebtThreshold: number };

  const staleThreads = pagesOfType("continuity-engine.thread")
    .filter((p) => {
      const s = p.system as ThreadSystemLike;
      return s.status === "open" && s.staleness >= config.staleThreshold;
    })
    .sort((a, b) => (b.system as ThreadSystemLike).staleness - (a.system as ThreadSystemLike).staleness)
    .map((p) => ({ name: p.name, uuid: p.uuid, chip: staleChip((p.system as ThreadSystemLike).staleness) }));

  const nearClocks = pagesOfType("continuity-engine.clock")
    .filter((p) => {
      const s = p.system as ClockSystemLike;
      return !s.complete && s.remaining <= 1;
    })
    .sort((a, b) => (a.system as ClockSystemLike).remaining - (b.system as ClockSystemLike).remaining)
    .map((p) => ({ name: p.name, uuid: p.uuid, remaining: (p.system as ClockSystemLike).remaining }));

  const beatDebt = pagesOfType("continuity-engine.beat")
    .filter((p) => {
      const s = p.system as BeatSystemLike;
      return s.stage !== "resolved" && s.debt >= config.beatDebtThreshold;
    })
    .sort((a, b) => (b.system as BeatSystemLike).debt - (a.system as BeatSystemLike).debt)
    .map((p) => ({ name: p.name, uuid: p.uuid, chip: overdueChip((p.system as BeatSystemLike).debt) }));

  const divergentKnowledge = pagesOfType("continuity-engine.knowledge")
    .filter((p) => (p.system as KnowledgeSystemLike).divergent)
    .map((p) => ({ name: p.name, uuid: p.uuid, chip: divergentChip(true) }));

  return {
    staleThreads,
    nearClocks,
    beatDebt,
    divergentKnowledge,
    nothingFlagged:
      staleThreads.length === 0 &&
      nearClocks.length === 0 &&
      beatDebt.length === 0 &&
      divergentKnowledge.length === 0,
  };
}
