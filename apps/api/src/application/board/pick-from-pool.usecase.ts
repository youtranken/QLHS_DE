import { Injectable } from '@nestjs/common'
import { LockRepo } from '../../infra/prisma/ticket/lock.repo'
import { SystemClock } from '../../infra/clock/system-clock'

@Injectable()
export class PickFromPoolUseCase {
  constructor(
    private readonly lock: LockRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string }): Promise<{ picked: boolean; heldBy?: string }> {
    return this.lock.pickFromPool(req.ticketId, req.actorSub, this.clock.now())
  }
}
