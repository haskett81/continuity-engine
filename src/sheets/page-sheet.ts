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

// Minimal P0 sheet: auto-renders scalar (string/HTML/number/boolean) fields
// from the page's own system schema so every sub-type is editable out of the
// box. Relational fields (ArrayField/DocumentUUIDField — owners, clocks,
// knownBy, events, etc.) are intentionally left out here; their editing
// surface is the Cockpit (spec §6), built in P2, not this fallback sheet.
export class ContinuityPageSheet extends SheetBase {
  static DEFAULT_OPTIONS = {
    classes: ["continuity-engine", "page-sheet"],
    position: { width: 520, height: "auto" as const },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

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

    return { ...context, system: page.system, sheetFields };
  }
}
