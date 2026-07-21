import { ContinuityCockpit } from "./cockpit.js";

// Chat command rather than a directory-header button injection: the exact
// DOM structure/hook signature for JournalDirectory varies enough across
// Foundry versions that guessing selectors risks a silent no-op. `/cockpit`
// is a stable, documented API surface. A nicer UI entry point (toolbar
// button) is a fast follow, not a P1 blocker.
export function registerCockpitButton(): void {
  Hooks.on("chatMessage", (_chatLog: unknown, message: string): boolean => {
    if (message.trim() === "/cockpit") {
      new ContinuityCockpit().render(true);
      return false;
    }
    return true;
  });
}
