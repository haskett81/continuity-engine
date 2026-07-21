/** Spec §4.6: debt = currentSession - lastServedSession. */
export function beatDebt(lastServedSession: number, currentSession: number): number {
  return currentSession - lastServedSession;
}
