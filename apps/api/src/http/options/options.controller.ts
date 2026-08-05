import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { OptionRepo, isOptionKind } from '../../infra/prisma/admin/option.repo'
import { GetDocumentTypesUseCase, type DocTypeGroup } from '../../application/admin/get-document-types.usecase'

/** Active create-form dropdown values (N3), readable by anyone who can create or
 *  handle a ticket. Read-only projection (values only); admin CRUD is /admin/options. */
@Controller('options')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Applicant, ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin)
export class OptionsController {
  constructor(
    private readonly options: OptionRepo,
    private readonly docTypes: GetDocumentTypesUseCase,
  ) {}

  // Khai báo TRƯỚC :kind để route tĩnh này thắng param (không lọt vào isOptionKind).
  @Get('document-types')
  documentTypes(): Promise<DocTypeGroup[]> {
    return this.docTypes.execute()
  }

  @Get(':kind')
  async active(@Param('kind') kind: string): Promise<string[]> {
    if (!isOptionKind(kind)) {
      throw new BadRequestException({ code: 'InvalidOptionKind', message: 'Loại danh mục không hợp lệ' })
    }
    const rows = await this.options.listActive(kind)
    return rows.map((r) => r.value)
  }
}
