// In-memory (not persisted) tracker of what got edited "during the session
// window" (spec §7), read by End Session to pre-fill its confirmation
// dialog. Reset on Begin Session, never on page reload — "during the
// session window" is a live-tracking concern, not something that needs to
// survive a reload.
const touchedThreads = new Set<string>();
const advancedClocks = new Set<string>();

interface UpdatedPageLike {
  type: string;
  uuid: string;
}

interface ChangesLike {
  system?: { filled?: number };
}

export function registerSessionTracker(): void {
  // Same narrow-cast-at-the-boundary pattern as module.ts's
  // onPreUpdateThreadPage registration — foundry-vtt-types' typed overload
  // for this hook expects the full JournalEntryPage system union; this
  // handler only touches `type`/`uuid`/`system.filled`, structurally
  // compatible with any union member at runtime.
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => number)(
    "updateJournalEntryPage",
    ((page: UpdatedPageLike, changes: ChangesLike) => {
      if (page.type === "continuity-engine.thread") {
        touchedThreads.add(page.uuid);
      } else if (page.type === "continuity-engine.clock" && changes.system?.filled !== undefined) {
        advancedClocks.add(page.uuid);
      }
    }) as (...args: unknown[]) => unknown,
  );
}

export function getTracked(): { threads: string[]; clocks: string[] } {
  return { threads: Array.from(touchedThreads), clocks: Array.from(advancedClocks) };
}

export function resetTracker(): void {
  touchedThreads.clear();
  advancedClocks.clear();
}
