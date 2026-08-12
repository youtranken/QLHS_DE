import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator'
import { DOCUMENT_NO_MAX } from '../../domain/ticket/document-no'

/** Batch pre-flight input: the Document Nos to test for an existing clash. The
 *  array cap mirrors a realistic column size and stops an oversized probe; each
 *  value shares the send DTO's length ceiling. */
export class CheckDocumentNosDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(DOCUMENT_NO_MAX, { each: true })
  documentNos!: string[]
}
