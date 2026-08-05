import { IsIn, IsOptional } from 'class-validator'
import { IsDateOnly } from '../common/is-date-only'

/** Analytics view: `granularity` buckets the throughput chart (default month). */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['week', 'month'])
  granularity?: 'week' | 'month'
}

/** CSV export bounds — `YYYY-MM-DD` day granularity, keeping an Invalid Date out
 *  of Prisma (date-500). Missing bounds default to a wide window at the edge. */
export class AnalyticsExportDto {
  @IsOptional()
  @IsDateOnly()
  from?: string

  @IsOptional()
  @IsDateOnly()
  to?: string
}
