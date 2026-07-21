import {
  ThreadModel,
  ClockModel,
  FactionModel,
  KnowledgeModel,
  SessionModel,
  BeatModel,
} from "./models/index.js";
import { registerSheets } from "./sheets/register.js";
import { registerLedger } from "./state/ledger.js";
import { registerCockpitEntryPoint } from "./apps/cockpit/register.js";

Hooks.once("init", () => {
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    "continuity-engine.thread": ThreadModel,
    "continuity-engine.clock": ClockModel,
    "continuity-engine.faction": FactionModel,
    "continuity-engine.knowledge": KnowledgeModel,
    "continuity-engine.session": SessionModel,
    "continuity-engine.beat": BeatModel,
  });

  registerSheets();
  registerLedger();
  registerCockpitEntryPoint();
});
