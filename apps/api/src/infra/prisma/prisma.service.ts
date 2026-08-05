import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { assertAppRoleNotSuperuser } from './superuser-guard'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    await this.$connect()
    await this.assertNotSuperuser()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  // Guard the AD-4 append-only invariant: it only holds for a non-superuser role.
  private async assertNotSuperuser(): Promise<void> {
    const rows = await this.$queryRaw<{ v: string }[]>`SELECT current_setting('is_superuser') AS v`
    const v = rows[0]?.v ?? 'off'
    if (v === 'on') {
      this.logger.warn(
        'DB role is a PostgreSQL superuser — the append-only audit trigger (AD-4) ' +
          'does NOT apply. Use the restricted qlhs_app role; this is refused in production.',
      )
    }
    assertAppRoleNotSuperuser(v, process.env.NODE_ENV === 'production')
  }
}
