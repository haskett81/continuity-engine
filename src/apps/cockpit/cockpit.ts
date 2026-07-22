import { getCurrentSession, setCurrentSession } from "../../state/session.js";
import { openDocumentSheet } from "../../foundry-utils.js";
import { prepareBoardContext } from "./tabs/board.js";
import { prepareThreadsContext, type ThreadSortKey } from "./tabs/threads.js";
import { prepareClocksContext } from "./tabs/clocks.js";
import { prepareFactionsContext } from "./tabs/factions.js";
import { prepareKnowledgeContext } from "./tabs/knowledge.js";
import { prepareCastContext } from "./tabs/cast.js";
import { prepareLogContext } from "./tabs/log.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

// Same "excessively deep instantiation" issue as sheets/base-sheet.ts's mixin
// cast — see the comment there for the full explanation. Purely a
// compile-time boundary; the runtime value is still the real mixin class.
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

// P2 scope (spec §6): full Cockpit tabs with mutation. Board stays read-only
// (its own concern); the other six tabs are the "editing surface for the
// Board" the spec describes. Rich-text fields (Faction agenda/current move,
// Knowledge truth/belief, Session recap) get a read-only preview + a
// click-through to the full sheet rather than inline editing — a compact
// dashboard row is the wrong place for a ProseMirror editor, and the sheets
// already handle that well. Cockpit-level mutation is for enums/numbers/
// sliders/toggles a GM wants to nudge without leaving the dashboard.
export class ContinuityCockpit extends AppBase {
  #threadSort: { key: ThreadSortKey; dir: 1 | -1 } = { key: "pressure", dir: -1 };

  static DEFAULT_OPTIONS = {
    id: "continuity-cockpit",
    classes: ["continuity-engine", "cockpit"],
    window: { title: "Continuity Cockpit", resizable: true },
    position: { width: 640, height: 720 },
    actions: {
      advanceClock: ContinuityCockpit.#onAdvanceClock,
      setLogCurrent: ContinuityCockpit.#onSetLogCurrent,
      sortThreads: ContinuityCockpit.#onSortThreads,
      openDoc: ContinuityCockpit.#onOpenDoc,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "board", icon: "fa-solid fa-gauge" },
        { id: "threads", icon: "fa-solid fa-timeline" },
        { id: "clocks", icon: "fa-solid fa-clock" },
        { id: "factions", icon: "fa-solid fa-flag" },
        { id: "knowledge", icon: "fa-solid fa-eye" },
        { id: "cast", icon: "fa-solid fa-users" },
        { id: "log", icon: "fa-solid fa-book" },
      ],
      initial: "board",
      labelPrefix: "CE.cockpit.tab",
    },
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    board: { template: "modules/continuity-engine/templates/cockpit/board.hbs" },
    threads: { template: "modules/continuity-engine/templates/cockpit/threads.hbs" },
    clocks: { template: "modules/continuity-engine/templates/cockpit/clocks.hbs" },
    factions: { template: "modules/continuity-engine/templates/cockpit/factions.hbs" },
    knowledge: { template: "modules/continuity-engine/templates/cockpit/knowledge.hbs" },
    cast: { template: "modules/continuity-engine/templates/cockpit/cast.hbs" },
    log: { template: "modules/continuity-engine/templates/cockpit/log.hbs" },
  };

  static #onAdvanceClock(this: ContinuityCockpit, _event: PointerEvent, target: HTMLElement): void {
    const uuid = target.dataset.uuid;
    const segment = Number(target.dataset.segment ?? -1);
    if (!uuid || segment < 0) return;
    void fromUuid(uuid).then((doc) => (doc as unknown as { update: (d: Record<string, unknown>) => Promise<unknown> })?.update({ "system.filled": segment + 1 }));
  }

  static #onSetLogCurrent(_event: PointerEvent, target: HTMLElement): void {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    void setCurrentSession(uuid);
  }

  static #onSortThreads(this: ContinuityCockpit, _event: PointerEvent, target: HTMLElement): void {
    const key = target.dataset.sortKey as ThreadSortKey | undefined;
    if (!key) return;
    if (this.#threadSort.key === key) this.#threadSort.dir = this.#threadSort.dir === 1 ? -1 : 1;
    else this.#threadSort = { key, dir: 1 };
    void this.render();
  }

  static #onOpenDoc(_event: PointerEvent, target: HTMLElement): void {
    const uuid = target.dataset.uuid;
    if (uuid) openDocumentSheet(uuid);
  }

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);

    return {
      ...context,
      tabs: this._prepareTabs("primary"),
      currentSession: getCurrentSession(),
      ...prepareBoardContext(),
      ...(await prepareThreadsContext(this.#threadSort)),
      ...prepareClocksContext(),
      ...(await prepareFactionsContext()),
      ...prepareKnowledgeContext(),
      ...(await prepareCastContext()),
      ...prepareLogContext(),
    };
  }

  override async _onRender(context: object, options: object): Promise<void> {
    await super._onRender(context, options);

    // Native-change-based mutation (as opposed to the click-based `actions`
    // map above): the Threads status <select> and Factions disposition
    // <input type=range> both fire on native `change`, not click, and the
    // Cockpit isn't bound to one document like a page sheet — so each row's
    // control carries its own target UUID/field rather than using the
    // sheets' single-document form-submit pattern.
    this.element.querySelectorAll<HTMLElement>("[data-cockpit-field]").forEach((el) => {
      el.addEventListener("change", () => {
        const uuid = el.dataset.uuid;
        const field = el.dataset.cockpitField;
        if (!uuid || !field) return;
        const value = el instanceof HTMLInputElement && el.type === "range" ? Number(el.value) : (el as HTMLInputElement | HTMLSelectElement).value;
        void fromUuid(uuid).then((doc) => (doc as unknown as { update: (d: Record<string, unknown>) => Promise<unknown> })?.update({ [field]: value }));
      });
    });
  }
}
