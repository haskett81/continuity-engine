const fields = foundry.data.fields;

function ledgerSchema() {
  return {
    campaignName: new fields.StringField({ required: true, blank: true, initial: "" }),
    sessionInProgress: new fields.BooleanField({ required: true, initial: false }),
    config: new fields.SchemaField({
      staleThreshold: new fields.NumberField({ required: true, integer: true, initial: 3, min: 1 }),
      beatDebtThreshold: new fields.NumberField({ required: true, integer: true, initial: 3, min: 1 }),
    }),
  };
}

export class LedgerModel extends foundry.abstract.DataModel<ReturnType<typeof ledgerSchema>> {
  static defineSchema(): ReturnType<typeof ledgerSchema> {
    return ledgerSchema();
  }
}

// foundry-vtt-types only types game.settings.register/get for the "core"
// namespace by default; a third-party module's keys are meant to be added via
// declaration-merging its own SettingConfig entries, which is disproportionate
// boilerplate for a two-call surface. Cast narrowly here instead — same
// pattern as the ApplicationV2 mixin workaround in page-sheet.ts. `game` is
// also typed as possibly undefined pre-ready; this only ever runs inside the
// init hook, where it's already populated.
type UntypedSettings = {
  register: (namespace: string, key: string, data: Record<string, unknown>) => void;
  get: (namespace: string, key: string) => unknown;
};

export function registerLedger(): void {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  settings.register("continuity-engine", "ledger", {
    name: "Continuity Ledger",
    hint: "World-scoped campaign configuration — thresholds for flagging stale threads and beat debt on the Cockpit Board. Current session lives on the Session page flagged \"current\", not here.",
    scope: "world",
    config: true,
    type: LedgerModel,
    default: {},
  });
}

export function getLedger(): LedgerModel {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  return settings.get("continuity-engine", "ledger") as LedgerModel;
}
