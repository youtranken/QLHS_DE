import { ArrayUnique, IsArray, IsIn } from 'class-validator'
import { ALL_ROLES } from '@qlhs/contracts'

export class SetRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_ROLES as unknown as string[], { each: true })
  roles!: string[]
}
