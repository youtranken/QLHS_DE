/**
 * An SLA threshold is a strictly-positive whole number of business days (PRD §8.2).
 * Closed statuses carry NO row (null threshold → no badge); a configured row must
 * always be ≥ 1. This is the domain rule; the DTO mirrors it as an early layer.
 */
export function isValidSlaDays(days: number): boolean {
  return Number.isInteger(days) && days > 0
}
