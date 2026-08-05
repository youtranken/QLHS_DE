/** Time source (AD-1). Injected so SLA/dwell logic stays pure and testable. */
export interface ClockPort {
  now(): Date
}
