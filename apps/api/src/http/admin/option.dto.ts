import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string
}

/** Thêm document type: tên + luồng (flow được kiểm ở use-case theo enum FLOW). */
export class AddDocumentTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  value!: string

  @IsString()
  @MinLength(1)
  flow!: string
}

export class UpdateOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

/** Ẩn / bật lại một document type. */
export class SetDocTypeActiveDto {
  @IsBoolean()
  active!: boolean
}

/** Bật/tắt hai cờ khả năng của loại luồng Contract (bảng ma trận). Cả hai optional
 *  — client gửi cờ nào thì đổi cờ đó (checkbox độc lập). */
export class SetDocTypeCapabilitiesDto {
  @IsOptional()
  @IsBoolean()
  requiresContractNo?: boolean

  @IsOptional()
  @IsBoolean()
  allowSkip?: boolean
}
