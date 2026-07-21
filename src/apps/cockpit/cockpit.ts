import { getLedger } from "../../state/ledger.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

// Same "excessively deep instantiation" issue as page-sheet.ts's mixin cast —
// see the comment there for the full explanation. Purely a compile-time
// boundary; the runtime value is still the real mixin class.
interface AppBaseLike {
  render(...args: unknown[]): unknown;
  close(...args: unknown[]): unknown;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
}

const AppBase = HandlebarsApplicationMixin(ApplicationV2) as unknown as new (
  ...args: any[]
) => AppBaseLike;

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

interface JournalPageLike {
  name: string;
  type: string;
  uuid: string;
  system: unknown;
}
interface JournalEntryLike {
  pages: { contents: JournalPageLike[] };
}

function pagesOfType(type: string): JournalPageLike[] {
  const journal = (game as unknown as { journal: { contents: JournalEntryLike[] } }).journal;
  return journal.contents.flatMap((entry) => entry.pages.contents).filter((page) => page.type === type);
}

// P1 scope (spec §6): Board only, read-only. Full tabbed Cockpit with
// mutation is P2 — do not add editing controls or other tabs here yet.
export class ContinuityCockpit extends AppBase {
  static DEFAULT_OPTIONS = {
    id: "continuity-cockpit",
    classes: ["continuity-engine", "cockpit"],
    window: { title: "Continuity Cockpit", resizable: true },
    position: { width: 480, height: 600 },
  };

  static PARTS = {
    board: { template: "modules/continuity-engine/templates/cockpit/board.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const ledger = getLedger();
    const config = ledger.config as { staleThreshold: number; beatDebtThreshold: number };

    const staleThreads = pagesOfType("continuity-engine.thread")
      .filter((p) => {
        const s = p.system as ThreadSystemLike;
        return s.status === "open" && s.staleness >= config.staleThreshold;
      })
      .sort((a, b) => (b.system as ThreadSystemLike).staleness - (a.system as ThreadSystemLike).staleness)
      .map((p) => ({ name: p.name, uuid: p.uuid, staleness: (p.system as ThreadSystemLike).staleness }));

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
      .map((p) => ({ name: p.name, uuid: p.uuid, debt: (p.system as BeatSystemLike).debt }));

    const divergentKnowledge = pagesOfType("continuity-engine.knowledge")
      .filter((p) => (p.system as KnowledgeSystemLike).divergent)
      .map((p) => ({ name: p.name, uuid: p.uuid }));

    return {
      ...context,
      currentSession: ledger.currentSession,
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
}
