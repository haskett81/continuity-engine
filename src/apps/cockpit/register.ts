import { ContinuityCockpit } from "./cockpit.js";

const MACRO_NAME = "Continuity Cockpit";

interface ModuleLike {
  api?: { openCockpit: () => void };
}

// Live-tested: a `chatMessage` hook cannot intercept custom slash commands
// in this world. dnd5e ships its own ChatLog override whose processMessage
// validates the command against a known list and throws synchronously,
// before core ever calls registered `chatMessage` hooks. That's a
// system-specific interception, not something we can hook around — and
// depending on chat-parsing internals in general is fragile across
// systems. A GM-facing macro is the system-agnostic, low-risk entry point:
// no DOM selectors, no hook-timing assumptions.
export function registerCockpitEntryPoint(): void {
  const mod = (game as unknown as { modules: Map<string, ModuleLike> }).modules.get(
    "continuity-engine",
  );
  if (mod) {
    mod.api = { openCockpit: () => void new ContinuityCockpit().render(true) };
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
      command: 'game.modules.get("continuity-engine").api.openCockpit();',
      img: "icons/svg/book.svg",
    });
  });
}
