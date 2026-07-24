export interface JournalPageLike {
  name: string;
  type: string;
  uuid: string;
  system: unknown;
  update: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
  getFlag: (scope: string, key: string) => unknown;
}

interface JournalEntryLike {
  pages: { contents: JournalPageLike[] };
}

/**
 * Every source-data reader in the module goes through this one helper — the
 * Cockpit's six tabs, the Board's attention flags, session tracking, the
 * Faction migration. It must never return a *published* copy (see
 * `state/publish.ts`): those live in their own journal, carry only a
 * sanitized field subset, and mixing them into source-data reads would
 * double-count things, skew `getCurrentSession()`, or run a migration meant
 * for real Faction data against a copy's already-representative value.
 *
 * Found live, not by inspection: a published Faction copy whose *source
 * page had been deleted* was still readable by players with stale data —
 * `pagesOfType` had no way to tell copies from sources apart in the first
 * place, so nothing here was ever actually scoped correctly, on top of the
 * separate cascade-delete gap this same investigation also turned up in
 * `publish.ts`.
 */
export function pagesOfType(type: string): JournalPageLike[] {
  const journal = (game as unknown as { journal: { contents: JournalEntryLike[] } }).journal;
  return journal.contents
    .flatMap((entry) => entry.pages.contents)
    .filter((page) => page.type === type && !page.getFlag("continuity-engine", "isPublishedCopy"));
}
