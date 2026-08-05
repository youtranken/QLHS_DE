import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface AppConfigWrite {
  vpName: string
  updatedBy: string | null
}

/** The singleton (id=1) app-config row. Reads/writes only — no delete. */
@Injectable()
export class AppConfigRepo {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.appConfig.findUnique({ where: { id: 1 } })
  }

  upsert(data: AppConfigWrite) {
    const { updatedBy, ...rest } = data
    return this.prisma.appConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...rest, updatedBy },
      update: { ...rest, updatedBy },
    })
  }
}
