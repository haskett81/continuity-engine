export interface JournalPageLike {
  name: string;
  type: string;
  uuid: string;
  system: unknown;
  update: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
}

interface JournalEntryLike {
  pages: { contents: JournalPageLike[] };
}

export function pagesOfType(type: string): JournalPageLike[] {
  const journal = (game as unknown as { journal: { contents: JournalEntryLike[] } }).journal;
  return journal.contents.flatMap((entry) => entry.pages.contents).filter((page) => page.type === type);
}
