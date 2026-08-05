import { IsOptional, IsString } from 'class-validator'
import { IsDateOnly } from '../common/is-date-only'

/** Query filters for the audit viewer (N2). `from`/`to` are day-granularity bounds;
 *  constraining them to `YYYY-MM-DD` keeps an Invalid Date out of Prisma (date-500).
 *  `page` stays a raw string — the domain `pageWindow()` already clamps it (≥1, ≤200). */
export class AuditFilterDto {
  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsString()
  sub?: string

  @IsOptional()
  @IsString()
  event?: string

  @IsOptional()
  @IsDateOnly()
  from?: string

  @IsOptional()
  @IsDateOnly()
  to?: string

  @IsOptional()
  @IsString()
  page?: string
}
