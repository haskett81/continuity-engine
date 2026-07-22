import { ThreadSheet } from "./thread-sheet.js";
import { FactionSheet } from "./faction-sheet.js";
import { ClockSheet } from "./clock-sheet.js";
import { BeatSheet } from "./beat-sheet.js";
import { SessionSheet } from "./session-sheet.js";
import { KnowledgeSheet } from "./knowledge-sheet.js";

const SHEETS: Array<[string, unknown]> = [
  ["continuity-engine.thread", ThreadSheet],
  ["continuity-engine.faction", FactionSheet],
  ["continuity-engine.clock", ClockSheet],
  ["continuity-engine.beat", BeatSheet],
  ["continuity-engine.session", SessionSheet],
  ["continuity-engine.knowledge", KnowledgeSheet],
];

export function registerSheets(): void {
  // Same excessively-deep-instantiation issue as base-sheet.ts's mixin cast:
  // registerSheet's own parameter typing is entangled in that generic chain.
  // Each sheet class is a real, runtime-compatible sheet constructor; only
  // the compile-time type is being widened here.
  for (const [type, sheetClass] of SHEETS) {
    DocumentSheetConfig.registerSheet(JournalEntryPage, "continuity-engine", sheetClass as unknown as typeof DocumentSheet, {
      types: [type],
      makeDefault: true,
      label: "CONTINUITY.SheetDefault",
    });
  }
}
