import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsBoolean } from 'class-validator'
import { AuthGuard } from './auth.guard'
import { GetCurrentUser, type CurrentUser } from './current-user'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'

export class DigestPrefDto {
  @IsBoolean()
  enabled!: boolean
}

/**
 * F11 — the user's own switch for the morning digest. Stored as opt-OUT in the
 * DB but exposed as `enabled` here, because "turn reminders on/off" is how a
 * person thinks about it, not "opt out".
 */
@Controller('me/digest')
@UseGuards(AuthGuard)
export class DigestPrefController {
  constructor(private readonly directory: UserDirectoryRepo) {}

  @Get()
  async get(@GetCurrentUser() user: CurrentUser): Promise<{ enabled: boolean }> {
    return { enabled: !(await this.directory.digestOptOut(user.sub)) }
  }

  @Post()
  async set(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: DigestPrefDto,
  ): Promise<{ enabled: boolean }> {
    await this.directory.setDigestOptOut(user.sub, !dto.enabled)
    return { enabled: dto.enabled }
  }
}
