import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'
import { DOCUMENT_NO_MAX } from '../../domain/ticket/document-no'

/** DCC2 phase-2 receipt: the "Ngày nhận từ DCC1" date (defaults to today when
 *  omitted). Recorded in the transition's audit meta, not a ticket column. */
export class Dcc2ReceiveDto {
  @IsOptional()
  @IsDateString()
  receivedAt?: string
}

/** DCC2 send-to-Accounting: the Document No is free-form (non-empty enforced in
 *  the use-case after trim); the length ceiling keeps an oversized value from
 *  overflowing the btree unique index. The DB UNIQUE index is the final guard (AD-20). */
export class SendAccountingDto {
  @IsString()
  @MaxLength(DOCUMENT_NO_MAX)
  documentNo!: string
}

/** DCC2 complete: the scan-path string (non-empty enforced in the use-case after
 *  trim, since @IsNotEmpty accepts whitespace). Never a file attachment (AD-7). */
export class CompleteContractDto {
  @IsString()
  scanPath!: string
}
