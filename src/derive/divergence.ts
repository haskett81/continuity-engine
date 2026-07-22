/**
 * Spec §4.4: `divergent` is true when partyBelief is non-empty and
 * reliability is "lie" or "rumour" — the campaign's live dramatic ironies.
 */
export function divergent(partyBelief: string, reliability: string): boolean {
  return partyBelief.trim().length > 0 && (reliability === "lie" || reliability === "rumour");
}
