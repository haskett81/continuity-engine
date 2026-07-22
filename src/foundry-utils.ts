// `game` is typed as possibly undefined pre-ready (foundry-vtt-types models
// the pre-init/pre-ready window accurately, but every call site across this
// module only ever runs from a rendered sheet or app, well after ready).
// Narrow cast at this one boundary instead of scattering non-null assertions
// everywhere `game.i18n` is used.
export function i18n(): {
  localize: (key: string) => string;
  format: (key: string, data?: Record<string, string>) => string;
} {
  return (game as unknown as { i18n: ReturnType<typeof i18n> }).i18n;
}

/** Opens a document's own sheet from just its UUID — the "click a name to open it" affordance used by every drop-slot and Cockpit row. */
export function openDocumentSheet(uuid: string): void {
  void fromUuid(uuid).then(
    (doc) => (doc as unknown as { sheet?: { render: (force: boolean) => void } })?.sheet?.render(true),
  );
}
