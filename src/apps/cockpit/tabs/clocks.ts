import { pagesOfType } from "../../../state/pages.js";
import { clockFillChip, type Chip } from "../../../ui/chips.js";
import { i18n } from "../../../foundry-utils.js";

interface ClockSystemLike {
  segments: number;
  filled: number;
  direction: string;
}

export function prepareClocksContext(): Record<string, unknown> {
  const pages = pagesOfType("continuity-engine.clock");

  const clocks = pages.map((p) => {
    const system = p.system as ClockSystemLike;
    const chips: Chip[] = [
      { text: i18n().localize(`CE.clock.chip.${system.direction}`), tone: "neutral" },
      { text: i18n().format("CE.clock.chip.fraction", { filled: String(system.filled), segments: String(system.segments) }), tone: "neutral" },
    ];
    const fillChip = clockFillChip(system.filled, system.segments);
    if (fillChip) chips.push(fillChip);

    const pips = Array.from({ length: system.segments }, (_, i) => ({ index: i, filled: i < system.filled }));

    return { uuid: p.uuid, name: p.name, direction: system.direction, pips, chips };
  });

  return { clocks };
}
