import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

/** SMTP settings from the admin form. host/username/from may be blank (blank host
 *  = fall back to the SMTP_* env). password is optional: omit/blank to keep the
 *  stored one. */
export class SmtpConfigDto {
  @IsString()
  @MaxLength(255)
  host!: string

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number

  @IsBoolean()
  secure!: boolean

  @IsString()
  @MaxLength(255)
  username!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string

  @IsString()
  @MaxLength(255)
  from!: string
}

/** Test-send: the same config plus the recipient to prove delivery works. */
export class SmtpTestDto extends SmtpConfigDto {
  // allow_display_name: chấp nhận cả dạng "Tên <email>" (hay gặp khi dán từ
  // Outlook) — nodemailer tự tách; vẫn chặn chuỗi không có địa chỉ hợp lệ.
  @IsEmail({ allow_display_name: true })
  @MaxLength(255)
  to!: string
}
