import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { DomainError } from '../../domain/errors'

const STATUS_BY_CODE: ReadonlyMap<string, number> = new Map([
  ['IllegalTransition', HttpStatus.CONFLICT],
  ['ForbiddenTransition', HttpStatus.FORBIDDEN],
  ['ReasonRequired', HttpStatus.BAD_REQUEST],
  ['TicketNotFound', HttpStatus.NOT_FOUND],
  ['NotTicketOwner', HttpStatus.FORBIDDEN],
  ['PriorityLocked', HttpStatus.CONFLICT],
  ['FieldsLocked', HttpStatus.CONFLICT],
  ['NotReversible', HttpStatus.CONFLICT],
  ['TicketNotClosed', HttpStatus.CONFLICT],
  ['ReconcileState', HttpStatus.CONFLICT],
  ['DocumentNoInvalid', HttpStatus.BAD_REQUEST],
  ['DocumentNoDuplicate', HttpStatus.CONFLICT],
  ['SlaDaysInvalid', HttpStatus.BAD_REQUEST],
  ['SlaConfigKeyInvalid', HttpStatus.BAD_REQUEST],
  ['SelfLockout', HttpStatus.CONFLICT],
  ['NotHolder', HttpStatus.FORBIDDEN],
  ['PauseReasonRequired', HttpStatus.BAD_REQUEST],
  ['PauseState', HttpStatus.CONFLICT],
])

/**
 * Maps any DomainError → the uniform envelope (AD-17). The http layer never
 * writes audit (AD-4) — it only translates failures.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>()
    const status = STATUS_BY_CODE.get(err.code) ?? HttpStatus.BAD_REQUEST
    res.status(status).json({ code: err.code, message: err.message })
  }
}
