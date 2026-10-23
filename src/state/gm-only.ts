// P4 hard requirement: all six page types stay GM-only, always, in the GM
// journal — structural, not a per-sheet conditional. Foundry permissions are
// per-document, so this is enforced by forcing `ownership.default` to NONE at
// creation and holding it there on every update, for every continuity-engine
// page — *except* published copies (state/publish.ts), which are the one
// deliberate, sanitized exception this rule carves out.
const CONTINUITY_TYPES = new Set([
  "continuity-engine.thread",
  "continuity-engine.clock",
  "continuity-engine.faction",
  "continuity-engine.knowledge",
  "continuity-engine.session",
  "continuity-engine.beat",
]);

interface CreateDataLike {
  type?: string;
  flags?: { "continuity-engine"?: { isPublishedCopy?: boolean } };
}

interface PreCreateDocLike {
  updateSource: (changes: Record<string, unknown>) => void;
}

interface PreUpdateDocLike {
  type: string;
  getFlag: (scope: string, key: string) => unknown;
}

interface OwnershipChangesLike {
  ownership?: { default?: number; [userId: string]: number | undefined };
}

export function registerGmOnlyEnforcement(): void {
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => number)(
    "preCreateJournalEntryPage",
    ((doc: PreCreateDocLike, data: CreateDataLike) => {
      if (!data.type || !CONTINUITY_TYPES.has(data.type)) return;
      if (data.flags?.["continuity-engine"]?.isPublishedCopy) return;
      doc.updateSource({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE });
    }) as (...args: unknown[]) => unknown,
  );

  // Unconditional, on every save — not just saves that happen to touch
  // ownership. A page created before this code existed (ownership.default
  // still -1/INHERIT from Foundry's own default) only gets explicitly
  // stamped NONE the first time *something* updates it otherwise; asserting
  // this on every update is what actually makes "always" true rather than
  // "true once someone remembers to check."
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)(
    "preUpdateJournalEntryPage",
    ((doc: PreUpdateDocLike, changes: OwnershipChangesLike) => {
      if (!CONTINUITY_TYPES.has(doc.type)) return;
      if (doc.getFlag("continuity-engine", "isPublishedCopy")) return;
      changes.ownership = { ...changes.ownership, default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
    }) as (...args: unknown[]) => unknown,
  );
}
