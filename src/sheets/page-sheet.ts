const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.api;

// `HandlebarsApplicationMixin(DocumentSheetV2<JournalEntryPage>)` used directly
// in an extends clause makes tsc report "Type instantiation is excessively deep
// and possibly infinite" — a known limitation of this beta types package's
// ApplicationV2 mixin generics (ties to the "known bugs... unfinished work"
// caveat in its own README), not a mistake in this code. The minimal interface
// below only types what this class actually touches (`document`,
// `_prepareContext`); the cast is purely compile-time — the runtime value is
// still the real mixin class, so behavior is unaffected. Revisit once
// foundry-vtt-types has fuller v14 ApplicationV2 coverage.
interface SheetBaseLike {
  document: JournalEntryPage;
  render(...args: unknown[]): unknown;
  _prepareContext(options: object): Promise<Record<string, unknown>>;
}

const SheetBase = HandlebarsApplicationMixin(DocumentSheetV2) as unknown as new (
  ...args: any[]
) => SheetBaseLike;

// One-line orientation per page type — UX pass criterion 1 (self-explanatory):
// the page's purpose should be legible on open, without external docs.
const SUBTITLES: Record<string, string> = {
  "continuity-engine.thread": "An open story thread the campaign is tracking.",
  "continuity-engine.clock": "A filling clock tracking pressure toward an event.",
  "continuity-engine.faction": "A power group, its agenda, and where it stands with the party.",
  "continuity-engine.knowledge": "Track what's true vs. what the party believes — and flag the gap.",
  "continuity-engine.session": "What happened, per session.",
  "continuity-engine.beat": "Personal-arc beats each PC is owed — so no one goes dark.",
};

// Minimal P0 sheet: auto-renders scalar (string/HTML/number/boolean) fields
// from the page's own system schema so every sub-type is editable out of the
// box. Relational fields (ArrayField/DocumentUUIDField — owners, clocks,
// knownBy, events, etc.) are intentionally left out here; their editing
// surface is the Cockpit (spec §6), built in P2, not this fallback sheet.
export class ContinuityPageSheet extends SheetBase {
  static DEFAULT_OPTIONS = {
    classes: ["continuity-engine", "page-sheet"],
    position: { width: 520, height: "auto" as const },
    form: {
      handler: ContinuityPageSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  // Live-tested: DocumentSheetV2 does NOT auto-apply form data to the
  // document without an explicit handler — submitOnChange alone had nothing
  // to call, so every change was silently discarded (confirmed via direct
  // document.update() working fine while sheet-driven changes did nothing).
  static async #onSubmitForm(
    this: ContinuityPageSheet,
    _event: Event,
    _form: HTMLFormElement,
    formData: { object: Record<string, unknown> },
  ): Promise<void> {
    await this.document.update(formData.object);
  }

  static PARTS = {
    form: { template: "modules/continuity-engine/templates/page-sheet.hbs" },
  };

  async _prepareContext(options: object): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const page = this.document;
    const system = page.system as unknown as {
      schema: { fields: Record<string, foundry.data.fields.DataField> };
    };
    const sheetFields: Record<string, foundry.data.fields.DataField> = {};

    for (const [key, field] of Object.entries(system.schema.fields)) {
      if (
        field instanceof foundry.data.fields.StringField ||
        field instanceof foundry.data.fields.NumberField ||
        field instanceof foundry.data.fields.BooleanField
      ) {
        sheetFields[key] = field;
      }
    }

    return {
      ...context,
      system: page.system,
      sheetFields,
      subtitle: SUBTITLES[page.type] ?? "",
    };
  }
}
