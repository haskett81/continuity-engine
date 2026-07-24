// P4 hard requirement: players open the Player View from the same dock icon
// as the GM opens the Cockpit from — not a per-player macro. One shared
// entry point, role-aware at click time.
//
// Verified live in the v14.363 target world before writing this: `#interface`
// (position: relative, a direct sibling of the `#board` canvas at the body
// level) is the correct overlay layer for a freely-positioned floating
// element — not `#ui-top`/`#ui-bottom` (fixed flex-layout chrome regions)
// or `#hud` (reserved for token HUDs).
import { ContinuityCockpit } from "../cockpit/cockpit.js";
import { PlayerView } from "../player-view/player-view.js";
import { prepareBoardContext } from "../cockpit/tabs/board.js";
import { i18n } from "../../foundry-utils.js";
import { ceMarkSvg } from "../../mark.js";

const ICON_ID = "continuity-engine-dock";
const DEFAULT_POSITION = { left: 20, top: 200 };
const DRAG_THRESHOLD_PX = 4;

type UntypedSettings = {
  register: (namespace: string, key: string, data: Record<string, unknown>) => void;
  get: (namespace: string, key: string) => unknown;
  set: (namespace: string, key: string, value: unknown) => Promise<unknown>;
};

interface ModuleLike {
  api?: { openCockpit: () => void; openPlayerView: () => void };
}

interface BoardFlagLike {
  staleThreads: unknown[];
  nearClocks: unknown[];
  beatDebt: unknown[];
  divergentKnowledge: unknown[];
}

function attentionCount(): number {
  const board = prepareBoardContext() as unknown as BoardFlagLike;
  return board.staleThreads.length + board.nearClocks.length + board.beatDebt.length + board.divergentKnowledge.length;
}

export function registerDockSettings(): void {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  settings.register("continuity-engine", "dockShowIcon", {
    name: "Show the dock icon",
    hint: "The floating button that opens the Cockpit (GM) or Campaign Chronicle (players).",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => applyDockVisibility(),
  });
  settings.register("continuity-engine", "dockPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_POSITION,
  });
}

function applyDockVisibility(): void {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  const show = settings.get("continuity-engine", "dockShowIcon") as boolean;
  const el = document.getElementById(ICON_ID);
  if (el) el.style.display = show ? "" : "none";
}

function openForCurrentUser(): void {
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
  if (isGM) void new ContinuityCockpit().render(true);
  else void new PlayerView().render(true);
}

function buildIcon(): HTMLElement {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  const pos = settings.get("continuity-engine", "dockPosition") as { left: number; top: number };
  const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;

  const el = document.createElement("div");
  el.id = ICON_ID;
  el.className = "continuity-engine ce-dock";
  el.style.left = `${pos.left}px`;
  el.style.top = `${pos.top}px`;
  el.setAttribute("role", "button");
  // "Continuity Cockpit" matches the GM macro's own name and the Cockpit
  // window's own (hardcoded, not localized) title; CE.playerView.title is
  // the real lang key for the other side.
  el.dataset.tooltip = isGM ? "Continuity Cockpit" : i18n().localize("CE.playerView.title");

  el.insertAdjacentHTML("beforeend", ceMarkSvg("ce-dock__icon"));

  if (isGM) {
    const badge = document.createElement("span");
    badge.className = "ce-dock__badge";
    const count = attentionCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "" : "none";
    el.appendChild(badge);
  }

  return el;
}

function bindDrag(el: HTMLElement): void {
  const settings = (game as unknown as { settings: UntypedSettings }).settings;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  el.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    originLeft = el.offsetLeft;
    originTop = el.offsetTop;
    // Pointer capture keeps the drag tracking even if the cursor leaves the
    // icon mid-drag. Best-effort: a capture failure must never block the
    // actual drag/click logic below it — caught live, a synthetic pointer
    // (as opposed to a real hardware one) can throw here.
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* capture unavailable for this pointer; dragging still works via bubbled events */
    }
  });

  el.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) moved = true;
    if (!moved) return;
    el.style.left = `${originLeft + dx}px`;
    el.style.top = `${originTop + dy}px`;
  });

  el.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {
      /* nothing captured to release; not an error condition */
    }
    if (moved) {
      void settings.set("continuity-engine", "dockPosition", { left: el.offsetLeft, top: el.offsetTop });
    } else {
      openForCurrentUser();
    }
  });
}

export function registerDockIcon(): void {
  Hooks.once("ready", () => {
    const mod = (game as unknown as { modules: Map<string, ModuleLike> }).modules.get("continuity-engine");
    if (mod) {
      mod.api = {
        ...mod.api,
        openCockpit: () => void new ContinuityCockpit().render(true),
        openPlayerView: () => void new PlayerView().render(true),
      };
    }

    const container = document.getElementById("interface");
    if (!container) return;

    const el = buildIcon();
    container.appendChild(el);
    bindDrag(el);
    applyDockVisibility();

    // Refresh the GM's attention badge whenever the underlying documents
    // change, rather than only on world load.
    const isGM = (game as unknown as { user: { isGM: boolean } }).user.isGM;
    if (isGM) {
      const refresh = () => {
        const badge = document.querySelector<HTMLElement>(`#${ICON_ID} .ce-dock__badge`);
        if (!badge) return;
        const count = attentionCount();
        badge.textContent = String(count);
        badge.style.display = count > 0 ? "" : "none";
      };
      (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)("updateJournalEntryPage", refresh as (...args: unknown[]) => unknown);
      (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)("createJournalEntryPage", refresh as (...args: unknown[]) => unknown);
      (Hooks.on as (name: string, fn: (...args: unknown[]) => unknown) => unknown)("deleteJournalEntryPage", refresh as (...args: unknown[]) => unknown);
    }
  });
}
