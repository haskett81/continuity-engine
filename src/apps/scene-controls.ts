// P4 (design book P3 "entry"): a second, native entry point alongside the
// dock icon — "two native entry points mean the Cockpit is always two
// clicks from a cold world load," in case the icon gets dragged offscreen
// or hidden via its own setting.
//
// Verified live in the v14.363 target world before writing this:
// `ui.controls.controls` is a plain object keyed by control name (not an
// array), and each control's own `.tools` is likewise object-keyed — the
// v12+ refactored `getSceneControlButtons` payload shape, not the older
// array-based one a lot of stale examples still assume.
import { ContinuityCockpit } from "./cockpit/cockpit.js";
import { PlayerView } from "./player-view/player-view.js";

interface ToolLike {
  name: string;
  title: string;
  icon: string;
  button: boolean;
  onClick: () => void;
}

interface ControlsLike {
  continuityEngine?: {
    name: string;
    title: string;
    icon: string;
    layer: null;
    tools: Record<string, ToolLike>;
  };
}

export function registerSceneControlEntry(): void {
  (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)(
    "getSceneControlButtons",
    ((controls: ControlsLike) => {
      const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
      controls.continuityEngine = {
        name: "continuityEngine",
        title: isGM ? "Continuity Cockpit" : "Campaign Chronicle",
        icon: "fa-solid fa-compass-drafting",
        layer: null,
        tools: {
          open: {
            name: "open",
            title: isGM ? "Open the Cockpit Board" : "Open the Campaign Chronicle",
            icon: "fa-solid fa-book-open",
            button: true,
            onClick: () => {
              if (isGM) void new ContinuityCockpit().render(true);
              else void new PlayerView().render(true);
            },
          },
        },
      };
    }) as (...args: unknown[]) => unknown,
  );
}
