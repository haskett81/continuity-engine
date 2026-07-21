import { ContinuityPageSheet } from "./page-sheet.js";

const SUB_TYPES = [
  "continuity-engine.thread",
  "continuity-engine.clock",
  "continuity-engine.faction",
  "continuity-engine.knowledge",
  "continuity-engine.session",
  "continuity-engine.beat",
];

export function registerSheets(): void {
  // Same excessively-deep-instantiation issue as page-sheet.ts's mixin cast:
  // registerSheet's own parameter typing is entangled in that generic chain.
  // ContinuityPageSheet is a real, runtime-compatible sheet constructor; only
  // the compile-time type is being widened here.
  DocumentSheetConfig.registerSheet(
    JournalEntryPage,
    "continuity-engine",
    ContinuityPageSheet as unknown as typeof DocumentSheet,
    {
      types: SUB_TYPES,
      makeDefault: true,
      label: "CONTINUITY.SheetDefault",
    },
  );
}
