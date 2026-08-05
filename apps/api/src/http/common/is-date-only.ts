import { registerDecorator, type ValidationOptions } from 'class-validator'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** True only for a real `YYYY-MM-DD` calendar day. Rejects ISO datetimes (which a
 *  controller's `${v}T00:00:00Z` concatenation would turn into an Invalid Date) and
 *  shape-valid-but-impossible days (2026-02-30) by round-tripping through UTC. */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** class-validator decorator wrapping {@link isDateOnly} — keeps date query params
 *  from reaching Prisma as Invalid Date (the date-500 class). */
export function IsDateOnly(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value) => isDateOnly(value),
        defaultMessage: () => `${propertyName} phải là ngày dạng YYYY-MM-DD`,
      },
    })
  }
}
