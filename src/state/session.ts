import { pagesOfType, type JournalPageLike } from "./pages.js";

interface SessionSystemLike {
  number: number;
  isCurrent: boolean;
}

/**
 * The current session's own page (not just its number) — needed by End
 * Session (P3) to write threadsTouched/clocksAdvanced onto it. Same
 * resolution order as getCurrentSession(): flagged page, else the
 * page with the highest number, else null if no Session pages exist yet.
 */
export function getCurrentSessionPage(): JournalPageLike | null {
  const sessionPages = pagesOfType("continuity-engine.session");
  if (sessionPages.length === 0) return null;

  const flagged = sessionPages.find((p) => (p.system as SessionSystemLike).isCurrent);
  if (flagged) return flagged;

  return sessionPages.reduce((highest, p) =>
    (p.system as SessionSystemLike).number > (highest.system as SessionSystemLike).number ? p : highest,
  );
}

/**
 * Spec §1.6 resolution order: (1) the Session page flagged isCurrent, (2)
 * fallback — highest sessionNumber among Session pages, (3) fallback — 0.
 * This replaces the old ledger.currentSession setting as the single source
 * of truth (spec §6.7) — a Session page flag, editable where the DM already
 * is, not a separate module setting.
 */
export function getCurrentSession(): number {
  const sessionPages = pagesOfType("continuity-engine.session");

  const flagged = sessionPages.find((p) => (p.system as SessionSystemLike).isCurrent);
  if (flagged) return (flagged.system as SessionSystemLike).number;

  if (sessionPages.length === 0) return 0;

  return Math.max(...sessionPages.map((p) => (p.system as SessionSystemLike).number));
}

/**
 * Clears isCurrent on every Session page except the one passed, then sets it
 * true there. Must run as an explicit batch — schema uniqueness isn't
 * enforced across sibling documents.
 */
export async function setCurrentSession(pageUuid: string): Promise<void> {
  const sessionPages = pagesOfType("continuity-engine.session");

  await Promise.all(
    sessionPages
      .filter((p) => p.uuid !== pageUuid && (p.system as SessionSystemLike).isCurrent)
      .map((p) => p.update({ "system.isCurrent": false })),
  );

  const target = sessionPages.find((p) => p.uuid === pageUuid);
  if (target) await target.update({ "system.isCurrent": true });
}
