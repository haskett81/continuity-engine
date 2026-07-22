import { ContinuityPageSheet, sessionFieldContext } from "./base-sheet.js";
import { staleChip, type Chip } from "../ui/chips.js";
import { i18n } from "../foundry-utils.js";
import { pressureBand } from "../derive/pressure.js";

interface ThreadSystemLike {
  status: string;
  stakes: string;
  pressure: number;
  openedSession: number;
  lastTouchedSession: number;
  resolvedSession: number | null;
  playerVisible: boolean;
  resolution: string;
  staleness: number;
}

const PRESSURE_BAND_KEYS = ["background", "building", "urgent", "breaking"];
const STATUS_KEYS = ["open", "active", "dormant", "resolved"];

export class ThreadSheet extends ContinuityPageSheet {
  static PARTS = {
    form: { template: "modules/continuity-engine/templates/thread-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const system = this.document.system as unknown as ThreadSystemLike;
    const activeBand = pressureBand(system.pressure);

    const chips: Chip[] = [
      { text: i18n().localize(`CE.thread.status.${system.status}`), tone: "neutral" },
      { text: i18n().localize(`CE.thread.pressure.band.${activeBand}`), tone: "neutral" },
    ];
    const stale = staleChip(system.staleness);
    if (stale) chips.push(stale);

    return {
      ...context,
      name: this.document.name,
      system,
      chips,
      statusChoices: Object.fromEntries(
        STATUS_KEYS.map((key) => [key, i18n().localize(`CE.thread.status.${key}`)]),
      ),
      pressureBands: PRESSURE_BAND_KEYS.map((key) => ({
        name: i18n().localize(`CE.thread.pressure.band.${key}`),
        active: key === activeBand,
      })),
      openedSession: sessionFieldContext({
        name: "system.openedSession",
        labelKey: "CE.thread.openedSession.label",
        hintKey: "CE.thread.openedSession.hint",
        value: system.openedSession,
      }),
      lastTouchedSession: sessionFieldContext({
        name: "system.lastTouchedSession",
        labelKey: "CE.thread.lastTouchedSession.label",
        hintKey: "CE.thread.lastTouchedSession.hint",
        value: system.lastTouchedSession,
      }),
      resolvedSession: sessionFieldContext({
        name: "system.resolvedSession",
        labelKey: "CE.thread.resolvedSession.label",
        hintKey: "CE.thread.resolvedSession.hint",
        value: system.resolvedSession,
      }),
      resolvedDisabled: system.status !== "resolved",
    };
  }
}
