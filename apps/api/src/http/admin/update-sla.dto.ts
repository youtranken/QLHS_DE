import { IsInt, Min } from 'class-validator'

/** Admin SLA threshold edit — a positive whole number of days (early layer; the
 *  use-case re-checks the same domain rule, Story 5.1 AC3). */
export class UpdateSlaDto {
  @IsInt()
  @Min(1)
  slaDays!: number
}
