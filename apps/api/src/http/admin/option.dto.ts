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
