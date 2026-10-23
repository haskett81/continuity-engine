import { exportCampaign } from "../state/export.js";

const MACRO_NAME = "Export Continuity Campaign";

interface ModuleLike {
  api?: Record<string, unknown>;
}

// Same reasoning as apps/cockpit/register.ts: a GM-facing macro is the
// system-agnostic, low-risk entry point for an infrequent, deliberate GM
// action — no dock-icon context-menu real estate needed for something a GM
// reaches for maybe once a campaign, not once a session.
export function registerExportEntryPoint(): void {
  const mod = (game as unknown as { modules: Map<string, ModuleLike> }).modules.get("continuity-engine");
  if (mod) {
    mod.api = { ...mod.api, exportCampaign: () => void exportCampaign() };
  }

  Hooks.once("ready", async () => {
    const g = game as unknown as {
      user: { isGM: boolean };
      macros: { find: (fn: (m: { name: string }) => boolean) => unknown };
    };
    if (!g.user.isGM) return;
    if (g.macros.find((m) => m.name === MACRO_NAME)) return;

    const MacroClass = Macro as unknown as {
      create: (data: Record<string, unknown>) => Promise<unknown>;
    };
    await MacroClass.create({
      name: MACRO_NAME,
      type: "script",
      scope: "global",
      command: 'game.modules.get("continuity-engine").api.exportCampaign();',
      img: "icons/svg/chest.svg",
    });
  });
}
