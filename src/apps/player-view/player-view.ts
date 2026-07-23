import { i18n } from "../../foundry-utils.js";
import { stripHtml, truncate } from "../../ui/text.js";
import { clockStatus } from "../../derive/clock.js";

// Same dial geometry as sheets/clock-sheet.ts's dialGeometry() — kept
// separate rather than shared, since importing a sheet module from here
// would pull ApplicationV2 sheet machinery into a read-only app that has
// no business depending on it. Radius/circumference must match exactly for
// the `.ce-dial__fill` CSS (styles/sheet.css) to render correctly either
// place it's used.
const DIAL_RADIUS = 40;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

// Same "excessively deep instantiation" mixin-cast pattern as cockpit.ts —
// see the comment there.
interface AppBaseLike {
  element: HTMLElement;
  render(...args: unknown[]): unknown;
  close(...args: unknown[]): unknown;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
  _prepareTabs(group: string): Record<string, unknown>;
  _onRender(context: object, options: object): Promise<void>;
}

const AppBase = HandlebarsApplicationMixin(ApplicationV2) as unknown as new (
  ...args: any[]
) => AppBaseLike;

const PUBLISHED_JOURNAL_NAME = "Continuity — Published";

interface PageLike {
  name: string;
  type: string;
  system: Record<string, unknown>;
}
interface JournalEntryLike {
  pages: { contents: PageLike[] };
}

/**
 * Design book P4: "A different product, not a filtered Cockpit." No counts,
 * no flags, no GM chrome, no raw pressure/disposition numbers — reads like
 * the campaign's own journal because, to a player, that's what it is. This
 * only ever reads the published journal (never the GM's own pages) — for a
 * player's client, the GM originals were never even transmitted (gm-only.ts),
 * so there's nothing else it *could* read.
 */
function publishedPages(): PageLike[] {
  const journal = (game as unknown as { journal: { getName: (name: string) => JournalEntryLike | undefined } }).journal;
  const entry = journal.getName(PUBLISHED_JOURNAL_NAME);
  return entry ? entry.pages.contents : [];
}

interface SessionSystemLike {
  number: number;
  date: string;
  recap: string;
}
interface ThreadSystemLike {
  status: string;
  stakes: string;
}
interface ClockSystemLike {
  filled: number;
  segments: number;
  direction: string;
}
interface FactionSystemLike {
  dispositionBand: string;
  currentMove: string;
}
interface KnowledgeSystemLike {
  partyBelief: string;
  source: string;
  revealedSession: number | null;
  reliability: string;
}
interface BeatSystemLike {
  hook: string;
}

function prepareStoryContext(): Record<string, unknown> {
  const sessions = publishedPages()
    .filter((p) => p.type === "continuity-engine.session")
    .map((p) => {
      const s = p.system as unknown as SessionSystemLike;
      return { name: p.name, number: s.number, date: s.date, recap: s.recap };
    })
    .sort((a, b) => b.number - a.number);
  return { sessions, storyEmpty: sessions.length === 0 };
}

function prepareChasingContext(): Record<string, unknown> {
  const threads = publishedPages()
    .filter((p) => p.type === "continuity-engine.thread")
    .map((p) => {
      const s = p.system as unknown as ThreadSystemLike;
      return { name: p.name, statusLabel: i18n().localize(`CE.thread.status.${s.status}`), stakes: s.stakes };
    });

  const clocks = publishedPages()
    .filter((p) => p.type === "continuity-engine.clock")
    .map((p) => {
      const s = p.system as unknown as ClockSystemLike;
      const { percent } = clockStatus(s.filled, s.segments);
      return {
        name: p.name,
        filled: s.filled,
        segments: s.segments,
        doom: s.direction === "doom",
        dial: { radius: DIAL_RADIUS, circumference: DIAL_CIRCUMFERENCE, dashOffset: DIAL_CIRCUMFERENCE * (1 - percent / 100) },
      };
    });

  return { threads, clocks, chasingEmpty: threads.length === 0 && clocks.length === 0 };
}

function prepareKnowContext(): Record<string, unknown> {
  const knowledge = publishedPages()
    .filter((p) => p.type === "continuity-engine.knowledge")
    .map((p) => {
      const s = p.system as unknown as KnowledgeSystemLike;
      return {
        name: p.name,
        belief: s.partyBelief,
        source: s.source,
        revealedSession: s.revealedSession,
        confidenceLabel: i18n().localize(`CE.knowledge.reliability.${s.reliability}`),
        confidenceTone: s.reliability === "rumour" ? "warn" : "good",
      };
    });
  return { knowledge, knowEmpty: knowledge.length === 0 };
}

function prepareMetContext(): Record<string, unknown> {
  const factions = publishedPages()
    .filter((p) => p.type === "continuity-engine.faction")
    .map((p) => {
      const s = p.system as unknown as FactionSystemLike;
      const hostile = s.dispositionBand === "hostile" || s.dispositionBand === "enemies" || s.dispositionBand === "factionSchemes" || s.dispositionBand === "hated";
      return {
        name: p.name,
        standingLabel: i18n().localize(`CE.faction.disposition.band.${s.dispositionBand}`),
        standingTone: hostile ? "alert" : s.dispositionBand === "neutral" || s.dispositionBand === "unfriendly" ? "neutral" : "good",
        currentMove: s.currentMove,
      };
    });
  return { factions, metEmpty: factions.length === 0 };
}

function prepareMineContext(): Record<string, unknown> {
  // No extra filtering needed — a Beat copy only ever reaches the client of
  // the specific user who owns the linked PC (state/publish.ts). Whatever
  // this client received *is* "mine." A GM previewing sees every player's,
  // which is expected: the GM already sees everything.
  const beats = publishedPages()
    .filter((p) => p.type === "continuity-engine.beat")
    .map((p) => ({ name: p.name, hook: p.system.hook as string }));
  return { beats, mineEmpty: beats.length === 0 };
}

export class PlayerView extends AppBase {
  static DEFAULT_OPTIONS = {
    id: "continuity-player-view",
    classes: ["continuity-engine", "player-view"],
    window: { title: "CE.playerView.title", resizable: true },
    position: { width: 640, height: 680 },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "story", icon: "fa-solid fa-book-open" },
        { id: "chasing", icon: "fa-solid fa-route" },
        { id: "know", icon: "fa-solid fa-eye" },
        { id: "met", icon: "fa-solid fa-flag" },
        { id: "mine", icon: "fa-solid fa-user" },
      ],
      initial: "story",
      labelPrefix: "CE.playerView.tab",
    },
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    story: { template: "modules/continuity-engine/templates/player-view/story.hbs" },
    chasing: { template: "modules/continuity-engine/templates/player-view/chasing.hbs" },
    know: { template: "modules/continuity-engine/templates/player-view/know.hbs" },
    met: { template: "modules/continuity-engine/templates/player-view/met.hbs" },
    mine: { template: "modules/continuity-engine/templates/player-view/mine.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    return {
      ...context,
      tabs: this._prepareTabs("primary"),
      ...prepareStoryContext(),
      ...prepareChasingContext(),
      ...prepareKnowContext(),
      ...prepareMetContext(),
      ...prepareMineContext(),
    };
  }
}

// Re-exported for the dock icon and any future entry point to share the
// exact same "strip empty ProseMirror markup, truncate" preview rule the
// rest of the module already uses (ui/text.js), rather than reinventing it.
export function previewText(html: string, maxLength: number): string {
  return truncate(stripHtml(html), maxLength);
}
