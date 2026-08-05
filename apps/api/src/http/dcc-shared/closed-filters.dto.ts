import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { IsDateOnly } from '../common/is-date-only'

/** Optional lookup filters + paging for the "Closed tickets" tab (FR-17). */
export class ClosedFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  code?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractor?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNo?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  applicant?: string

  @IsOptional()
  @IsDateOnly()
  from?: string

  @IsOptional()
  @IsDateOnly()
  to?: string

  /** Opaque keyset token from the previous page (absent = first page). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string

  /** Page size; the use-case clamps to [1, 100]. Query strings arrive as text, so
   *  @Type coerces to a number for validation. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
