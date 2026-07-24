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
const MENU_ID = "continuity-engine-dock-menu";
// Position is stored as viewport percentages, not pixels — a pixel position
// saved on one monitor is nonsense on another. Roughly matches the old
// pixel default (20, 200) on a typical viewport.
const DEFAULT_POSITION_PCT = { xPct: 2, yPct: 22 };
const SIZE_PRESETS = { small: 32, medium: 46, large: 64 } as const;
const MIN_SIZE_PX = 28;
const MAX_SIZE_PX = 96;
const DRAG_THRESHOLD_PX = 4;
const README_GETTING_STARTED_URL = "https://github.com/haskett81/continuity-engine#getting-started";

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

interface NotificationsLike {
  info: (msg: string) => void;
}

interface PositionPct {
  xPct: number;
  yPct: number;
}

function settingsApi(): UntypedSettings {
  return (game as unknown as { settings: UntypedSettings }).settings;
}

function isCurrentUserGM(): boolean {
  return (game as unknown as { user: { isGM: boolean } }).user.isGM;
}

function attentionCount(): number {
  const board = prepareBoardContext() as unknown as BoardFlagLike;
  return board.staleThreads.length + board.nearClocks.length + board.beatDebt.length + board.divergentKnowledge.length;
}

export function registerDockSettings(): void {
  const settings = settingsApi();
  settings.register("continuity-engine", "dockShowIcon", {
    name: "Show the dock icon",
    hint: "The floating button that opens the Cockpit (GM) or Campaign Chronicle (players). Turn back on here if you've hidden it.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => applyDockVisibility(),
  });
  // Position/size/locked are all client-scoped and per-user by construction
  // (Foundry client settings are already per-user, not per-world) — two GMs
  // in the same world each get their own icon placement, never overwriting
  // each other's.
  settings.register("continuity-engine", "dockPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_POSITION_PCT,
  });
  settings.register("continuity-engine", "dockSizePx", {
    scope: "client",
    config: false,
    type: Number,
    default: SIZE_PRESETS.medium,
  });
  settings.register("continuity-engine", "dockLocked", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
}

function readPositionPct(): PositionPct {
  // Defensive against the pre-percentage pixel-based shape ({left, top})
  // that may still be sitting in a client's stored settings from before
  // this format changed — fall back to the default rather than computing
  // nonsense from a `left`/`top` that no longer mean anything here.
  const raw = settingsApi().get("continuity-engine", "dockPosition") as Partial<PositionPct> | undefined;
  const xPct = typeof raw?.xPct === "number" ? raw.xPct : DEFAULT_POSITION_PCT.xPct;
  const yPct = typeof raw?.yPct === "number" ? raw.yPct : DEFAULT_POSITION_PCT.yPct;
  return { xPct, yPct };
}

function readSizePx(): number {
  const raw = settingsApi().get("continuity-engine", "dockSizePx");
  const n = typeof raw === "number" ? raw : SIZE_PRESETS.medium;
  return Math.max(MIN_SIZE_PX, Math.min(MAX_SIZE_PX, n));
}

function readLocked(): boolean {
  return settingsApi().get("continuity-engine", "dockLocked") === true;
}

function pxFromPct(pct: PositionPct, sizePx: number): { left: number; top: number } {
  const maxLeft = Math.max(0, window.innerWidth - sizePx);
  const maxTop = Math.max(0, window.innerHeight - sizePx);
  const left = Math.min(maxLeft, Math.max(0, (pct.xPct / 100) * window.innerWidth));
  const top = Math.min(maxTop, Math.max(0, (pct.yPct / 100) * window.innerHeight));
  return { left, top };
}

function pctFromPx(left: number, top: number, sizePx: number): PositionPct {
  const maxLeft = Math.max(1, window.innerWidth - sizePx);
  const maxTop = Math.max(1, window.innerHeight - sizePx);
  const clampedLeft = Math.min(maxLeft, Math.max(0, left));
  const clampedTop = Math.min(maxTop, Math.max(0, top));
  return { xPct: (clampedLeft / window.innerWidth) * 100, yPct: (clampedTop / window.innerHeight) * 100 };
}

function applyPositionAndSize(el: HTMLElement, pct: PositionPct, sizePx: number): void {
  const { left, top } = pxFromPct(pct, sizePx);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  const grip = el.querySelector<HTMLElement>(".ce-dock__grip");
  if (grip) {
    // Scale with the icon, but never shrink below a usable hit area, and
    // never blow up to a "speck vs. icon" mismatch at the large end either.
    const gripSize = Math.max(14, Math.round(sizePx * 0.28));
    grip.style.width = `${gripSize}px`;
    grip.style.height = `${gripSize}px`;
  }
}

function applyDockVisibility(): void {
  const show = settingsApi().get("continuity-engine", "dockShowIcon") as boolean;
  const el = document.getElementById(ICON_ID);
  if (el) el.style.display = show ? "" : "none";
}

function openCockpit(): void {
  void new ContinuityCockpit().render(true);
}

function openPlayerView(): void {
  void new PlayerView().render(true);
}

function openForCurrentUser(): void {
  if (isCurrentUserGM()) openCockpit();
  else openPlayerView();
}

function openModuleSettings(): void {
  // `game.settings.sheet` is the stable entry point for the core Settings
  // Configuration app across recent Foundry versions — verified live in the
  // v14.363 target world rather than assumed.
  const sheet = (game as unknown as { settings: { sheet: { render: (force: boolean) => void } } }).settings.sheet;
  sheet.render(true);
}

async function hideIcon(): Promise<void> {
  await settingsApi().set("continuity-engine", "dockShowIcon", false);
  (ui as unknown as { notifications: NotificationsLike }).notifications.info(
    i18n().localize("CE.dock.hiddenNotice"),
  );
}

async function toggleLocked(): Promise<void> {
  await settingsApi().set("continuity-engine", "dockLocked", !readLocked());
}

async function setSizePreset(el: HTMLElement, sizePx: number): Promise<void> {
  await settingsApi().set("continuity-engine", "dockSizePx", sizePx);
  applyPositionAndSize(el, readPositionPct(), sizePx);
}

async function resetSizeAndPosition(el: HTMLElement): Promise<void> {
  await settingsApi().set("continuity-engine", "dockPosition", DEFAULT_POSITION_PCT);
  await settingsApi().set("continuity-engine", "dockSizePx", SIZE_PRESETS.medium);
  applyPositionAndSize(el, DEFAULT_POSITION_PCT, SIZE_PRESETS.medium);
}

function buildIcon(): HTMLElement {
  const isGM = isCurrentUserGM();

  const el = document.createElement("div");
  el.id = ICON_ID;
  el.className = "continuity-engine ce-dock";
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

  const grip = document.createElement("div");
  grip.className = "ce-dock__grip";
  grip.dataset.tooltip = "Drag to resize";
  el.appendChild(grip);

  return el;
}

/** Menu item groups: shared builder for both roles — the GM menu is a
 * superset (extra Primary entry, extra Help & recovery entries), not a
 * second, independently-maintained menu. */
interface MenuItem {
  label: string;
  run: () => void | Promise<void>;
  checked?: boolean;
  disabled?: boolean;
  tooltip?: string;
}

function buildMenuGroups(el: HTMLElement, isGM: boolean): MenuItem[][] {
  const sizePx = readSizePx();
  const locked = readLocked();
  const t = (key: string) => i18n().localize(`CE.dock.menu.${key}`);

  const primary: MenuItem[] = isGM
    ? [
        { label: t("openCockpit"), run: openCockpit },
        { label: t("playerPreview"), run: openPlayerView },
      ]
    : [{ label: t("openChronicle"), run: openPlayerView }];

  const appearance: MenuItem[] = [
    { label: t("sizeSmall"), run: () => setSizePreset(el, SIZE_PRESETS.small), checked: sizePx === SIZE_PRESETS.small },
    { label: t("sizeMedium"), run: () => setSizePreset(el, SIZE_PRESETS.medium), checked: sizePx === SIZE_PRESETS.medium },
    { label: t("sizeLarge"), run: () => setSizePreset(el, SIZE_PRESETS.large), checked: sizePx === SIZE_PRESETS.large },
    { label: t("lockPosition"), run: toggleLocked, checked: locked },
    { label: t("resetSizePosition"), run: () => resetSizeAndPosition(el) },
  ];

  const recovery: MenuItem[] = isGM
    ? [
        { label: t("howToUse"), run: () => window.open(README_GETTING_STARTED_URL, "_blank", "noopener") },
        { label: t("moduleSettings"), run: openModuleSettings },
        { label: t("hideIcon"), run: hideIcon },
      ]
    : [{ label: t("hideIcon"), run: hideIcon }];

  return [primary, appearance, recovery];
}

let closeMenuOnPointerDown: ((event: Event) => void) | null = null;
let closeMenuOnEscape: ((event: KeyboardEvent) => void) | null = null;

function closeDockMenu(): void {
  document.getElementById(MENU_ID)?.remove();
  if (closeMenuOnPointerDown) {
    document.removeEventListener("pointerdown", closeMenuOnPointerDown, true);
    closeMenuOnPointerDown = null;
  }
  if (closeMenuOnEscape) {
    document.removeEventListener("keydown", closeMenuOnEscape);
    closeMenuOnEscape = null;
  }
}

function openDockMenu(el: HTMLElement, clientX: number, clientY: number): void {
  closeDockMenu();

  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.className = "continuity-engine ce-dock-menu";
  menu.setAttribute("role", "menu");

  const groups = buildMenuGroups(el, isCurrentUserGM());
  groups.forEach((group, i) => {
    if (group.length === 0) return;
    if (i > 0) {
      const sep = document.createElement("hr");
      sep.className = "ce-dock-menu__separator";
      sep.setAttribute("role", "separator");
      menu.appendChild(sep);
    }
    for (const item of group) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ce-dock-menu__item";
      btn.setAttribute("role", "menuitem");
      btn.textContent = item.label;
      if (item.checked) {
        btn.classList.add("ce-dock-menu__item--checked");
        btn.setAttribute("aria-checked", "true");
      }
      if (item.tooltip) btn.dataset.tooltip = item.tooltip;
      if (item.disabled) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      } else {
        btn.addEventListener("click", () => {
          closeDockMenu();
          void item.run();
        });
      }
      menu.appendChild(btn);
    }
  });

  document.getElementById("interface")?.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width - 4);
  const maxTop = Math.max(0, window.innerHeight - rect.height - 4);
  menu.style.left = `${Math.min(clientX, maxLeft)}px`;
  menu.style.top = `${Math.min(clientY, maxTop)}px`;

  menu.querySelector<HTMLButtonElement>(".ce-dock-menu__item:not([disabled])")?.focus();

  closeMenuOnPointerDown = (event: Event) => {
    if (!menu.contains(event.target as Node)) closeDockMenu();
  };
  // Deferred so the same right-click that opened the menu doesn't also
  // register as the "click outside" that immediately closes it.
  setTimeout(() => document.addEventListener("pointerdown", closeMenuOnPointerDown!, true), 0);

  closeMenuOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeDockMenu();
      el.focus?.();
    }
  };
  document.addEventListener("keydown", closeMenuOnEscape);
}

function bindInteractions(el: HTMLElement): void {
  const grip = el.querySelector<HTMLElement>(".ce-dock__grip")!;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  el.addEventListener("pointerdown", (event) => {
    if (event.button === 2 || event.target === grip || readLocked()) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    originLeft = el.offsetLeft;
    originTop = el.offsetTop;
    // Best-effort: a capture failure must never block the actual drag/click
    // logic below it — caught live, a synthetic pointer (as opposed to a
    // real hardware one) can throw here.
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
    const sizePx = readSizePx();
    const maxLeft = Math.max(0, window.innerWidth - sizePx);
    const maxTop = Math.max(0, window.innerHeight - sizePx);
    el.style.left = `${Math.min(maxLeft, Math.max(0, originLeft + dx))}px`;
    el.style.top = `${Math.min(maxTop, Math.max(0, originTop + dy))}px`;
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
      const pct = pctFromPx(el.offsetLeft, el.offsetTop, readSizePx());
      void settingsApi().set("continuity-engine", "dockPosition", pct);
    } else {
      openForCurrentUser();
    }
  });

  grip.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const startSize = readSizePx();
    const gStartX = event.clientX;
    const gStartY = event.clientY;
    let currentSize = startSize;
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      /* best-effort, same as the main drag handler above */
    }

    const move = (e: PointerEvent) => {
      const delta = Math.max(e.clientX - gStartX, e.clientY - gStartY);
      currentSize = Math.max(MIN_SIZE_PX, Math.min(MAX_SIZE_PX, startSize + delta));
      applyPositionAndSize(el, readPositionPct(), currentSize);
    };
    const up = (e: PointerEvent) => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch {
        /* nothing captured to release */
      }
      void settingsApi().set("continuity-engine", "dockSizePx", currentSize);
      void settingsApi().set("continuity-engine", "dockPosition", pctFromPx(el.offsetLeft, el.offsetTop, currentSize));
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });

  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openDockMenu(el, event.clientX, event.clientY);
  });
}

export function registerDockIcon(): void {
  Hooks.once("ready", () => {
    const mod = (game as unknown as { modules: Map<string, ModuleLike> }).modules.get("continuity-engine");
    if (mod) {
      mod.api = { ...mod.api, openCockpit, openPlayerView };
    }

    const container = document.getElementById("interface");
    if (!container) return;

    const el = buildIcon();
    container.appendChild(el);
    applyPositionAndSize(el, readPositionPct(), readSizePx());
    bindInteractions(el);
    applyDockVisibility();

    window.addEventListener("resize", () => {
      applyPositionAndSize(el, readPositionPct(), readSizePx());
    });

    // Refresh the GM's attention badge whenever the underlying documents
    // change, rather than only on world load.
    if (isCurrentUserGM()) {
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
