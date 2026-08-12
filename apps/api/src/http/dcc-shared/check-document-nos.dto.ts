import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator'
import { FLOW } from '@qlhs/contracts'
import { DOCUMENT_NO_MAX } from '../../domain/ticket/document-no'

/** Batch pre-flight input: the numbers to test for an existing clash, scoped to
 *  the flow entering them (Contract → contract_no, Payment → payment_no). The
 *  array cap mirrors a realistic column size and stops an oversized probe; each
 *  value shares the send DTO's length ceiling. */
export class CheckDocumentNosDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(DOCUMENT_NO_MAX, { each: true })
  documentNos!: string[]

  @IsIn([FLOW.Contract, FLOW.Payment])
  flow!: string
}
