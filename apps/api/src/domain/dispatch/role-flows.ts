import { FLOW, ROLE, type Flow, type Role } from '@qlhs/contracts'

/**
 * Which flows a role may see on the dispatch map (AD-16 scope). DCC1 (+Admin)
 * coordinate all three; DCC2 sees only Contract; DCC3 only Payment; Applicant
 * has no map. Enforced at the server — never trust the FE.
 */
export function roleFlows(role: Role | null): Flow[] {
  switch (role) {
    case ROLE.Dcc1:
    case ROLE.Admin:
      return [FLOW.General, FLOW.Contract, FLOW.Payment]
    case ROLE.Dcc2:
      return [FLOW.Contract]
    case ROLE.Dcc3:
      return [FLOW.Payment]
    default:
      return []
  }
}
