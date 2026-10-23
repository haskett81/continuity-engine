import { appendSessionEvent } from "../state/session-lifecycle.js";

// Spec §7: "Automatic markers only for unambiguous structural events: scene
// activated, combat started, combat ended." Hook names verified live in the
// v14.363 target world before writing this (per this project's standing
// practice): scene activation has no dedicated hook — it's `updateScene`
// with `changes.active === true` (confirmed: activating a scene fires
// `updateScene` twice, once deactivating the old one, once activating the
// new one — only the `active: true` side is the marker). `combatStart`
// fires on `combat.startCombat()` (not on Combat creation — creating a
// Combat document alone does not fire it). Combat ending has no dedicated
// hook either — the core "End Combat" UI action deletes the Combat
// document, so `deleteCombat` is the marker.
//
// No-ops whenever no session is current (via appendSessionEvent) — Begin
// Session stays the only thing that starts session tracking; auto-markers
// never create a session.

export function registerStructuralMarkers(): void {
  Hooks.on("updateScene", (scene, changes) => {
    if (changes.active === true) {
      void appendSessionEvent("scene", scene.name, scene.id ? [`Scene.${scene.id}`] : []);
    }
  });

  Hooks.on("combatStart", (combat) => {
    void appendSessionEvent("combat-start", "Combat started", combat.id ? [`Combat.${combat.id}`] : []);
  });

  Hooks.on("deleteCombat", (combat) => {
    void appendSessionEvent("combat-end", "Combat ended", combat.id ? [`Combat.${combat.id}`] : []);
  });
}
