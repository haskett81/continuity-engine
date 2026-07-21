/** Spec §4.1: staleness = currentSession - lastTouchedSession. */
export function staleness(lastTouchedSession: number, currentSession: number): number {
  return currentSession - lastTouchedSession;
}
