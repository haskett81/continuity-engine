// Sheet UX spec §3: group the six Continuity Engine page types together and
// first in the "Create Page" dialog's type <select>, ahead of core/system
// types (which fall under a single "Foundry" group per the spec's example).
//
// Verified live in Cyrus's v14.363 world before writing this (per spec §3.4
// and this project's established practice of not shipping against a
// remembered API shape):
//   - The Create Page dialog is a generic `DialogV2` (title "Create Page"),
//     not a dedicated per-document-type application — detect it by the
//     presence of `select[name="type"]` containing our type values, not by
//     title or class name (title isn't guaranteed stable/localized).
//   - It fires `Hooks.on("renderDialogV2", (app, html, context, options) =>
//     ...)` with `html` as a raw `HTMLDialogElement` (ApplicationV2's
//     standard render-hook shape), not jQuery.
import { i18n } from "../foundry-utils.js";

const TYPE_ORDER = ["session", "thread", "faction", "clock", "knowledge", "beat"];

export function registerTypePickerGrouping(): void {
  Hooks.on("renderDialogV2", (_app: unknown, html: HTMLElement) => {
    const select = html.querySelector<HTMLSelectElement>('select[name="type"]');
    if (!select) return;

    const options = Array.from(select.options);
    const ceOptions = options.filter((o) => o.value.startsWith("continuity-engine."));
    if (ceOptions.length === 0) return;

    ceOptions.sort((a, b) => {
      const aKey = a.value.split(".")[1] ?? "";
      const bKey = b.value.split(".")[1] ?? "";
      return TYPE_ORDER.indexOf(aKey) - TYPE_ORDER.indexOf(bKey);
    });

    const otherOptions = options.filter((o) => !o.value.startsWith("continuity-engine."));

    const ceGroup = document.createElement("optgroup");
    ceGroup.label = i18n().localize("CE.typePicker.continuityGroup");
    ceOptions.forEach((o) => ceGroup.appendChild(o));

    const coreGroup = document.createElement("optgroup");
    coreGroup.label = i18n().localize("CE.typePicker.foundryGroup");
    otherOptions.forEach((o) => coreGroup.appendChild(o));

    select.replaceChildren(ceGroup, coreGroup);
  });
}
