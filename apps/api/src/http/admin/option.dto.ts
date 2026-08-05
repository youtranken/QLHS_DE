import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string
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
