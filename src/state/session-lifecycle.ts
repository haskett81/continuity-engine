import { getCurrentSession, setCurrentSession, getCurrentSessionPage } from "./session.js";
import { getTracked, resetTracker } from "./session-tracker.js";
import { i18n } from "../foundry-utils.js";

const SESSION_LOG_ENTRY_NAME = "Continuity — Sessions";

interface JournalEntryLike {
  name: string;
  id: string;
}

// `game.journal`/`JournalEntry`/`JournalEntryPage` are typed well enough
// elsewhere in this codebase to use directly (see sheets/register.ts,
// apps/cockpit/register.ts) — no narrow cast needed here beyond the
// `game` pre-ready gap already documented in foundry-utils.ts.
async function getOrCreateSessionLogEntry(): Promise<JournalEntryLike> {
  const journal = (game as unknown as { journal: { find: (fn: (j: JournalEntryLike) => boolean) => JournalEntryLike | undefined } }).journal;
  const existing = journal.find((j) => j.name === SESSION_LOG_ENTRY_NAME);
  if (existing) return existing;

  const EntryClass = JournalEntry as unknown as { create: (data: Record<string, unknown>) => Promise<JournalEntryLike> };
  return EntryClass.create({ name: SESSION_LOG_ENTRY_NAME });
}

/** Spec §7: increments the session number, creates the session page, flags it current. */
export async function beginSession(): Promise<void> {
  const entry = await getOrCreateSessionLogEntry();
  const nextNumber = getCurrentSession() + 1;

  const PageClass = JournalEntryPage as unknown as {
    create: (data: Record<string, unknown>, options: Record<string, unknown>) => Promise<{ uuid: string } | undefined>;
  };
  const page = await PageClass.create(
    { name: `Session ${nextNumber}`, type: "continuity-engine.session", system: { number: nextNumber } },
    { parent: entry },
  );
  if (!page) return;

  await setCurrentSession(page.uuid);
  resetTracker();
}

interface EventEntry {
  timestamp: string;
  kind: string;
  text: string;
  refs: string[];
}

interface SessionEventsSystemLike {
  events: EventEntry[];
}

/** Appends an event to the current session's events array. No-op if no session is current — shared by structural auto-markers and the Cockpit's manual quick-add. */
export async function appendSessionEvent(kind: string, text: string, refs: string[]): Promise<void> {
  const page = getCurrentSessionPage();
  if (!page) return;

  const existing = (page.system as SessionEventsSystemLike).events ?? [];
  const entry: EventEntry = { timestamp: new Date().toISOString(), kind, text, refs };
  await page.update({ "system.events": [...existing, entry] });
}

interface ResolvedForDialog {
  uuid: string;
  name: string;
}

async function resolveForDialog(uuids: string[]): Promise<ResolvedForDialog[]> {
  const docs = await Promise.all(
    uuids.map(async (uuid) => {
      const doc = (await fromUuid(uuid)) as { name?: string } | null;
      return doc ? { uuid, name: doc.name ?? uuid } : null;
    }),
  );
  return docs.filter((d): d is ResolvedForDialog => d !== null);
}

function checklistHtml(id: string, items: ResolvedForDialog[]): string {
  if (items.length === 0) return "";
  return items
    .map(
      (item) =>
        `<label style="display:block;"><input type="checkbox" name="${id}" value="${item.uuid}" checked> ${item.name}</label>`,
    )
    .join("");
}

/**
 * Spec §7: prompts the GM to confirm which threads/clocks to stamp, prefilled
 * from state/session-tracker.ts's live-tracked edits. Does NOT create the
 * next session or clear isCurrent — advancing to session N+1 is a separate,
 * later Begin Session action (state/session.ts's own principle: advancing
 * the current session is always explicit, never automatic).
 */
export async function endSession(): Promise<void> {
  const currentPage = getCurrentSessionPage();
  if (!currentPage) return;

  const tracked = getTracked();
  const [threads, clocks] = await Promise.all([resolveForDialog(tracked.threads), resolveForDialog(tracked.clocks)]);

  if (threads.length === 0 && clocks.length === 0) {
    resetTracker();
    return;
  }

  const { DialogV2 } = foundry.applications.api;
  const content = `
    ${threads.length ? `<fieldset><legend>${i18n().localize("CE.cockpit.log.endSessionDialog.threads")}</legend>${checklistHtml("thread", threads)}</fieldset>` : ""}
    ${clocks.length ? `<fieldset><legend>${i18n().localize("CE.cockpit.log.endSessionDialog.clocks")}</legend>${checklistHtml("clock", clocks)}</fieldset>` : ""}
  `;

  const confirmed = await DialogV2.wait({
    window: { title: i18n().localize("CE.cockpit.log.endSessionDialog.title") },
    content,
    buttons: [
      {
        action: "confirm",
        label: i18n().localize("CE.cockpit.log.endSessionDialog.confirm"),
        default: true,
        callback: (_event: unknown, button: HTMLButtonElement) => {
          const form = button.form;
          const threadUuids = form ? Array.from(form.querySelectorAll<HTMLInputElement>('input[name="thread"]:checked')).map((el) => el.value) : [];
          const clockUuids = form ? Array.from(form.querySelectorAll<HTMLInputElement>('input[name="clock"]:checked')).map((el) => el.value) : [];
          return { threadUuids, clockUuids };
        },
      },
      { action: "cancel", label: i18n().localize("CE.common.cancel") },
    ],
    rejectClose: false,
  });

  if (!confirmed || typeof confirmed !== "object") return;

  const { threadUuids, clockUuids } = confirmed as unknown as { threadUuids: string[]; clockUuids: string[] };
  const endingNumber = (currentPage.system as { number: number }).number;

  await Promise.all([
    ...threadUuids.map(async (uuid: string) => {
      const doc = (await fromUuid(uuid)) as { update: (d: Record<string, unknown>) => Promise<unknown> } | null;
      await doc?.update({ "system.lastTouchedSession": endingNumber });
    }),
    ...clockUuids.map(async (uuid: string) => {
      const doc = (await fromUuid(uuid)) as { update: (d: Record<string, unknown>) => Promise<unknown> } | null;
      await doc?.update({ "system.lastAdvancedSession": endingNumber });
    }),
  ]);

  await currentPage.update({ "system.threadsTouched": threadUuids, "system.clocksAdvanced": clockUuids });
  resetTracker();
}
