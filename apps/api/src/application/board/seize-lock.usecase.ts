import { Injectable } from '@nestjs/common'
import { LockRepo } from '../../infra/prisma/ticket/lock.repo'
import { SystemClock } from '../../infra/clock/system-clock'

@Injectable()
export class SeizeLockUseCase {
  constructor(
    private readonly lock: LockRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: {
    ticketId: string
    actorSub: string
  }): Promise<{ acquired: boolean; holderSub: string; seized: boolean }> {
    return this.lock.seize(req.ticketId, req.actorSub, this.clock.now())
  }
}
