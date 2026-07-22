import { getCurrentSession, setCurrentSession } from "../state/session.js";
import { getLedger } from "../state/ledger.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.api;

// `HandlebarsApplicationMixin(DocumentSheetV2<JournalEntryPage>)` used directly
// in an extends clause makes tsc report "Type instantiation is excessively deep
// and possibly infinite" — a known limitation of this beta types package's
// ApplicationV2 mixin generics. The minimal interface below only types what
// sheets built on this base actually touch; the cast is purely compile-time —
// the runtime value is still the real mixin class, so behavior is unaffected.
interface SheetBaseLike {
  document: JournalEntryPage;
  element: HTMLElement;
  render(...args: unknown[]): unknown;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
  _onRender(context: object, options: object): Promise<void>;
}

const SheetBase = HandlebarsApplicationMixin(DocumentSheetV2) as unknown as new (
  ...args: any[]
) => SheetBaseLike;

// `game` is typed as possibly undefined pre-ready (same gap noted in
// state/ledger.ts) — every call site here only ever runs while a sheet is
// actually rendering, well after ready. Narrow cast at this one boundary
// instead of scattering non-null assertions through every helper below.
function i18n(): { localize: (key: string) => string; format: (key: string, data?: Record<string, string>) => string } {
  return (game as unknown as { i18n: ReturnType<typeof i18n> }).i18n;
}

export type ChipTone = "neutral" | "warn" | "alert" | "positive" | "negative";

export interface Chip {
  text: string;
  tone: ChipTone;
}

export interface SessionFieldContext {
  name: string;
  label: string;
  hint?: string;
  value: number | null;
  disabled?: boolean;
  currentSession: number;
  sessionsAgoText: string;
  nowTooltip: string;
}

export interface ResolvedDoc {
  uuid: string;
  name: string;
  img?: string;
}

export interface DropSlotContext {
  field: string;
  label: string;
  emptyText: string;
  doc: ResolvedDoc | null;
}

/** Spec §1.6: the universal "Last touched in session [N] [Now] · N sessions ago" pattern. */
export function sessionFieldContext(opts: {
  name: string;
  labelKey: string;
  hintKey?: string;
  value: number | null;
  disabled?: boolean;
}): SessionFieldContext {
  const currentSession = getCurrentSession();
  let sessionsAgoText = "";

  if (opts.value !== null) {
    const diff = currentSession - opts.value;
    if (diff > 0) sessionsAgoText = i18n().format("CE.common.sessionsAgo", { n: String(diff) });
    else if (diff === 0) sessionsAgoText = i18n().localize("CE.common.thisSession");
    else sessionsAgoText = i18n().localize("CE.common.nextSession");
  }

  return {
    name: opts.name,
    label: i18n().localize(opts.labelKey),
    hint: opts.hintKey ? i18n().localize(opts.hintKey) : undefined,
    value: opts.value,
    disabled: opts.disabled,
    currentSession,
    sessionsAgoText,
    nowTooltip: i18n().format("CE.common.stampTooltip", { session: String(currentSession) }),
  };
}

async function resolveDoc(uuid: string): Promise<ResolvedDoc | null> {
  if (!uuid) return null;
  const doc = (await fromUuid(uuid)) as { name?: string; img?: string } | null;
  if (!doc) return null;
  return { uuid, name: doc.name ?? uuid, img: doc.img };
}

/** Spec §1.7: a single document drop slot, empty/filled state. */
export async function dropSlotContext(opts: {
  field: string;
  labelKey: string;
  emptyTextKey: string;
  uuid: string;
}): Promise<DropSlotContext> {
  return {
    field: opts.field,
    label: i18n().localize(opts.labelKey),
    emptyText: i18n().localize(opts.emptyTextKey),
    doc: await resolveDoc(opts.uuid),
  };
}

/** Spec §1.7 multi-value variant (Session attendees): a list of drop slots. */
export async function dropListContext(opts: {
  field: string;
  labelKey: string;
  emptyTextKey: string;
  uuids: string[];
}): Promise<{ field: string; label: string; emptyText: string; docs: ResolvedDoc[] }> {
  const docs = (await Promise.all(opts.uuids.map(resolveDoc))).filter((d): d is ResolvedDoc => d !== null);
  return {
    field: opts.field,
    label: i18n().localize(opts.labelKey),
    emptyText: i18n().localize(opts.emptyTextKey),
    docs,
  };
}

/** Spec §1.5 chip table — shared conditions used by more than one page type. */
export function staleChip(staleness: number): Chip | null {
  const threshold = (getLedger().config as { staleThreshold: number }).staleThreshold;
  if (staleness < threshold) return null;
  return { text: i18n().format("CE.common.staleChip", { n: String(staleness) }), tone: "warn" };
}

export function overdueChip(debt: number): Chip | null {
  const threshold = (getLedger().config as { beatDebtThreshold: number }).beatDebtThreshold;
  if (debt < threshold) return null;
  return { text: i18n().format("CE.beat.chip.overdue", { n: String(debt) }), tone: "warn" };
}

export function clockFillChip(filled: number, segments: number): Chip | null {
  if (filled >= segments) return { text: i18n().localize("CE.clock.chip.filled"), tone: "alert" };
  if (filled === segments - 1) return { text: i18n().localize("CE.clock.chip.nearlyFull"), tone: "warn" };
  return null;
}

export function divergentChip(divergent: boolean): Chip | null {
  return divergent ? { text: i18n().localize("CE.knowledge.chip.divergent"), tone: "warn" } : null;
}

export { i18n };

export abstract class ContinuityPageSheet extends SheetBase {
  static DEFAULT_OPTIONS = {
    classes: ["continuity-engine", "ce-sheet"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: {
      handler: ContinuityPageSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      stampNow: ContinuityPageSheet.#onStampNow,
      clearDrop: ContinuityPageSheet.#onClearDrop,
      removeFromList: ContinuityPageSheet.#onRemoveFromList,
      adjustClock: ContinuityPageSheet.#onAdjustClock,
      openDoc: ContinuityPageSheet.#onOpenDoc,
      // Only Session sheets render a `data-action="setCurrent"` control;
      // registered on the shared base rather than re-declaring
      // DEFAULT_OPTIONS on SessionSheet, which TS's static-side override
      // checking requires to exactly match this object's full shape.
      setCurrent: ContinuityPageSheet.#onSetCurrent,
    },
  };

  // Live-tested (P0): DocumentSheetV2 does NOT auto-apply form data to the
  // document without an explicit handler — submitOnChange alone had nothing
  // to call, so every change was silently discarded.
  static async #onSubmitForm(
    this: ContinuityPageSheet,
    _event: Event,
    _form: HTMLFormElement,
    formData: { object: Record<string, unknown> },
  ): Promise<void> {
    await this.document.update(formData.object);
  }

  static #onStampNow(this: ContinuityPageSheet, _event: PointerEvent, target: HTMLElement): void {
    const field = target.dataset.field;
    if (!field) return;
    const update: Record<string, unknown> = { [field]: getCurrentSession() };
    void this.document.update(update);
  }

  static #onClearDrop(this: ContinuityPageSheet, _event: PointerEvent, target: HTMLElement): void {
    const field = target.closest<HTMLElement>("[data-field]")?.dataset.field;
    if (!field) return;
    const update: Record<string, unknown> = { [field]: "" };
    void this.document.update(update);
  }

  static #onRemoveFromList(this: ContinuityPageSheet, _event: PointerEvent, target: HTMLElement): void {
    const slot = target.closest<HTMLElement>("[data-field]");
    const field = slot?.dataset.field;
    const uuid = target.dataset.uuid;
    if (!field || !uuid) return;
    const current = (foundry.utils.getProperty(this.document, field) as string[] | undefined) ?? [];
    const update: Record<string, unknown> = { [field]: current.filter((u) => u !== uuid) };
    void this.document.update(update);
  }

  static #onAdjustClock(this: ContinuityPageSheet, _event: PointerEvent, target: HTMLElement): void {
    const delta = Number(target.dataset.delta ?? 0);
    const system = this.document.system as unknown as { filled: number; segments: number };
    const next = Math.min(Math.max(system.filled + delta, 0), system.segments);
    const update: Record<string, unknown> = { "system.filled": next };
    void this.document.update(update);
  }

  static #onOpenDoc(_event: PointerEvent, target: HTMLElement): void {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    void fromUuid(uuid).then((doc) => (doc as unknown as { sheet?: { render: (force: boolean) => void } })?.sheet?.render(true));
  }

  static #onSetCurrent(this: ContinuityPageSheet): void {
    void setCurrentSession(this.document.uuid);
  }

  override async _onRender(context: object, options: object): Promise<void> {
    await super._onRender(context, options);

    // Verified live in the v14.363 target world: `foundry.applications.ux
    // .DragDrop.implementation` is the real, fully-featured base class (the
    // bare global `DragDrop` is shadowed by dnd5e's system-specific
    // `DragDrop5e` subclass on this world — using it here would violate the
    // module's system-agnostic non-goal even though it happens to work under
    // dnd5e).
    const dragDrop = new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".ce-drop-slot",
      permissions: { drop: () => true },
      callbacks: { drop: this.#onDrop.bind(this) },
    });
    dragDrop.bind(this.element);
  }

  async #onDrop(event: DragEvent): Promise<void> {
    const slot = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement>(".ce-drop-slot");
    const field = slot?.dataset.field;
    if (!field) return;

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event) as {
      type?: string;
      uuid?: string;
    } | null;
    if (!data?.uuid) return;

    if (slot.dataset.multi === "true") {
      const current = (foundry.utils.getProperty(this.document, field) as string[] | undefined) ?? [];
      if (!current.includes(data.uuid)) {
        const update: Record<string, unknown> = { [field]: [...current, data.uuid] };
        await this.document.update(update);
      }
    } else {
      const update: Record<string, unknown> = { [field]: data.uuid };
      await this.document.update(update);
    }
  }
}
