import {
  ThreadModel,
  ClockModel,
  FactionModel,
  KnowledgeModel,
  SessionModel,
  BeatModel,
  onPreUpdateThreadPage,
} from "./models/index.js";
import { registerSheets } from "./sheets/register.js";
import { registerLedger } from "./state/ledger.js";
import { registerSchemaVersionSetting, runMigrations } from "./state/migrations.js";
import { registerCockpitEntryPoint } from "./apps/cockpit/register.js";
import { registerTypePickerGrouping } from "./apps/type-picker.js";
import { registerSessionTracker } from "./state/session-tracker.js";
import { registerStructuralMarkers } from "./apps/structural-markers.js";

Hooks.once("init", async () => {
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    "continuity-engine.thread": ThreadModel,
    "continuity-engine.clock": ClockModel,
    "continuity-engine.faction": FactionModel,
    "continuity-engine.knowledge": KnowledgeModel,
    "continuity-engine.session": SessionModel,
    "continuity-engine.beat": BeatModel,
  });

  await foundry.applications.handlebars.loadTemplates({
    "continuity-session-field": "modules/continuity-engine/templates/partials/session-field.hbs",
    "continuity-drop-slot": "modules/continuity-engine/templates/partials/drop-slot.hbs",
    "continuity-drop-list": "modules/continuity-engine/templates/partials/drop-list.hbs",
  });

  registerSheets();
  registerLedger();
  registerSchemaVersionSetting();
  registerCockpitEntryPoint();
  registerTypePickerGrouping();
  registerSessionTracker();
  registerStructuralMarkers();

  // foundry-vtt-types' preUpdateJournalEntryPage overload requires the real
  // (very large) JournalEntryPage system union type; onPreUpdateThreadPage
  // only touches `type` and `system.resolvedSession`/`status`, structurally
  // compatible with any of that union's members at runtime. Same
  // narrow-cast-at-the-boundary pattern used elsewhere in this codebase for
  // gaps in this beta types package.
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => number)(
    "preUpdateJournalEntryPage",
    onPreUpdateThreadPage as (...args: unknown[]) => unknown,
  );
});

Hooks.once("ready", () => {
  void runMigrations();
});
