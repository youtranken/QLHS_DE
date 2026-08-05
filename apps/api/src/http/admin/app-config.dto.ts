import { IsString, Length } from 'class-validator'

/** Admin › Cấu hình › Tên VP. The VP display name (1–40 chars). */
export class AppConfigDto {
  @IsString()
  @Length(1, 40)
  vpName!: string
}
