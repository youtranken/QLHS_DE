import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { ALL_DOCUMENT_TYPES, ALL_PRIORITIES } from '@qlhs/contracts'
import { DOCUMENT_NO_MAX } from '../../domain/ticket/document-no'

const DOC_TYPES = ALL_DOCUMENT_TYPES as unknown as string[]
const PRIORITIES = ALL_PRIORITIES as unknown as string[]

// Upper bounds on every free-text field: reject oversized input at the edge
// before it reaches the DB, so a caller can't wedge a multi-MB string into a
// column. Identifier-like fields share DOCUMENT_NO_MAX (200) for consistency
// with the DCC2 send DTO; description is a long note (4000).
const NOTE_MAX = 4000
const CODE_MAX = 100
const CURRENCY_MAX = 20
// `amount` is written to a Postgres BIGINT (int8, max 9223372036854775807 = 19
// digits). An 18-digit value ALWAYS fits, so cap the digit count at 18: a 19- or
// 20-digit string would pass validation, BigInt() would accept it (arbitrary
// precision), then the INSERT would overflow int8 and surface as a raw 500
// instead of a clean 400. 18 digits (≤ 9.99e17 smallest units) is ample.
const AMOUNT_MAX = 18

/** 9 mandatory fields (FR-1). No file attachment field exists — by design. */
export class CreateTicketDto {
  @IsIn(DOC_TYPES)
  documentType!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_MAX)
  description!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_NO_MAX)
  paymentTerm!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_NO_MAX)
  contractNo!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_NO_MAX)
  projectTeam!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(CURRENCY_MAX)
  currency!: string

  @Matches(/^\d+$/, { message: 'amount phải là số nguyên (đơn vị nhỏ nhất)' })
  @MaxLength(AMOUNT_MAX)
  amount!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(CODE_MAX)
  budgetCode!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_NO_MAX)
  contractor!: string

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string
}

export class ChangePriorityDto {
  @IsIn(PRIORITIES)
  priority!: string
}

export class CloneTicketDto {
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string
}
