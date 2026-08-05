import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROLE } from '@qlhs/contracts'
import { t } from '../../i18n'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { toast } from '../../shared/toast'
import { listUsers, setUserRoles, type UserWithRoles } from './api'

/** Vai elevated có thể gán (Applicant là mặc định của mọi người, không phải nhóm).
 *  Ràng buộc nghiệp vụ: 1 người chỉ 1 vai trong 1 nhóm — các vai này loại trừ nhau. */
const GROUPS = [ROLE.Admin, ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3] as const
const MANAGED: readonly string[] = GROUPS
/** Pseudo-group: the full-directory view (every user + their role). */
const ALL = 'all'

const GROUP_CODE: Record<string, string> = {
  [ROLE.Admin]: 'AD',
  [ROLE.Dcc1]: 'D1',
  [ROLE.Dcc2]: 'D2',
  [ROLE.Dcc3]: 'D3',
}

/** Hàm (không const) để mô tả nhóm đọc lại catalog mỗi render — sẵn cho đổi ngôn ngữ. */
function groupDesc(g: string): string {
  switch (g) {
    case ROLE.Admin:
      return t('adminUsers.groupDesc.admin')
    case ROLE.Dcc1:
      return t('adminUsers.groupDesc.dcc1')
    case ROLE.Dcc2:
      return t('adminUsers.groupDesc.dcc2')
    case ROLE.Dcc3:
      return t('adminUsers.groupDesc.dcc3')
    default:
      return ''
  }
}

function initials(s: string): string {
  const parts = s.split(/[^A-Za-zÀ-ỹ0-9]+/).filter(Boolean)
  const pick =
    parts.length >= 2 ? parts[0]!.charAt(0) + parts[1]!.charAt(0) : (parts[0] ?? s).slice(0, 2)
  return pick.toUpperCase() || '—'
}

/** Vai elevated duy nhất user đang giữ, hoặc null nếu chỉ là Applicant. */
function groupOf(u: UserWithRoles): string | null {
  return GROUPS.find((r) => u.roles.includes(r)) ?? null
}

/** sub dạng UUID = tài khoản chưa có PMH-ID người-đọc-được → không đáng hiển thị thô. */
const isUuidSub = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

function matches(u: UserWithRoles, t: string): boolean {
  return (
    (u.fullName ?? '').toLowerCase().includes(t) ||
    (u.email ?? '').toLowerCase().includes(t) ||
    u.sub.toLowerCase().includes(t)
  )
}

/* Inline icons (module scope = defined once, reused per row). */
const IC_SEARCH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
)
const IC_APPOINT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="8" r="3.4" /><path d="M4 20a6 6 0 0 1 12 0" /><path d="M19 8v6M22 11h-6" /></svg>
)
const IC_PLUS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
)
const IC_ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="M14 6l6 6-6 6" /></svg>
)
const IC_X = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const IC_USERS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M18 20a5 5 0 0 0-3-4.6" /></svg>
)

/** SA console (audit §K) — quản vai THEO NHÓM: chọn nhóm bên trái, xem/thêm/gỡ
 *  thành viên bên phải. Hợp với thực tế 300–400 user (hầu hết Applicant, chỉ vài
 *  người thuộc DCC/Admin) — không phải cuộn cả danh sách để tìm người. */
export function AdminUsers() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [group, setGroup] = useState<string>(ROLE.Dcc1)
  const [q, setQ] = useState('')
  const [pendingAdmin, setPendingAdmin] = useState<UserWithRoles | null>(null)

  const load = useCallback(async () => {
    setUsers(await listUsers())
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const g of GROUPS) c[g] = 0
    for (const u of users) {
      const g = groupOf(u)
      if (g) c[g]! += 1
    }
    return c
  }, [users])

  const isAll = group === ALL

  const members = useMemo(() => {
    if (isAll) {
      const term = q.trim().toLowerCase()
      return term ? users.filter((u) => matches(u, term)) : users
    }
    return users.filter((u) => groupOf(u) === group)
  }, [users, group, q, isAll])

  const candidates = useMemo(() => {
    if (isAll) return []
    const t = q.trim().toLowerCase()
    if (!t) return []
    return users.filter((u) => groupOf(u) !== group && matches(u, t)).slice(0, 8)
  }, [users, group, q, isAll])

  /** 1 vai 1 nhóm: bỏ mọi vai managed rồi thêm đúng một → thêm cũng là "chuyển". */
  async function assign(u: UserWithRoles, to: string) {
    const name = u.fullName ?? u.sub
    await setUserRoles(u.sub, u.roles.filter((r) => !MANAGED.includes(r)).concat(to))
    setQ('')
    await load()
    toast.ok(t('adminUsers.assignedToast', { name, group: to }))
  }
  /** Admin là vai toàn quyền — chặn một bước xác nhận trước khi gán. */
  function requestAssign(u: UserWithRoles) {
    if (group === ROLE.Admin) setPendingAdmin(u)
    else void assign(u, group)
  }
  /** Gỡ là thao tác đảo được → làm ngay + toast Hoàn tác (thay cho modal chặn). */
  async function remove(u: UserWithRoles) {
    const name = u.fullName ?? u.sub
    const prevRoles = u.roles
    await setUserRoles(u.sub, u.roles.filter((r) => !MANAGED.includes(r)))
    await load()
    toast.action(t('adminUsers.removedToast', { name, group }), {
      label: t('adminUsers.undo'),
      run: async () => {
        await setUserRoles(u.sub, prevRoles)
        await load()
        toast.ok(t('adminUsers.undoneToast', { name }))
      },
    })
  }

  return (
    <section aria-label={t('adminUsers.title')}>
      <h1 className="sr-only">{t('adminUsers.title')}</h1>
      <div className="grp">
        <aside className="card grp-list" aria-label={t('adminUsers.groupsAria')}>
          <div className="grp-eyebrow">{t('adminUsers.groupsEyebrow')}</div>
          <button
            type="button"
            className={isAll ? 'grp-item on' : 'grp-item'}
            aria-current={isAll ? 'true' : undefined}
            onClick={() => {
              setGroup(ALL)
              setQ('')
            }}
          >
            <span className="gi-code roster" aria-hidden>
              ∑
            </span>
            <span className="gi-txt">
              <span className="gi-nm">{t('adminUsers.allGroup')}</span>
              <span className="gi-desc">{t('adminUsers.allDesc')}</span>
            </span>
            <span className="gi-ct">{users.length}</span>
          </button>
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={group === g ? 'grp-item on' : 'grp-item'}
              aria-current={group === g ? 'true' : undefined}
              onClick={() => {
                setGroup(g)
                setQ('')
              }}
            >
              <span className="gi-code" aria-hidden>
                {GROUP_CODE[g]}
              </span>
              <span className="gi-txt">
                <span className="gi-nm" lang="en">
                  {g}
                </span>
                <span className="gi-desc">{groupDesc(g)}</span>
              </span>
              <span className="gi-ct">{counts[g] ?? 0}</span>
            </button>
          ))}
          <p className="grp-note">
            <b>Applicant</b>{t('adminUsers.noteSuffix')}
          </p>
        </aside>

        <div className="grp-detail">
          <div className="gd-hd">
            <div className="gd-id">
              {isAll ? <h2>{t('adminUsers.allGroup')}</h2> : <h2 lang="en">{group}</h2>}
              <span className="gd-desc">{isAll ? t('adminUsers.allDesc') : groupDesc(group)}</span>
            </div>
            <span className="gd-ct" role="status" aria-live="polite">
              {isAll
                ? t('adminUsers.allCount', { n: members.length })
                : t('adminUsers.memberCount', { n: members.length })}
            </span>
          </div>

          {isAll ? (
            <div className="search-field">
              <span aria-hidden>{IC_SEARCH}</span>
              <input
                type="search"
                placeholder={t('adminUsers.allSearchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t('adminUsers.allSearchAria')}
              />
            </div>
          ) : (
            <div className="card appoint">
              <span className="appoint-accent" aria-hidden />
              <div className="appoint-head">
                <span className="appoint-ic" aria-hidden>
                  {IC_APPOINT}
                </span>
                <div>
                  <div className="appoint-eyebrow">{t('adminUsers.appointEyebrow')}</div>
                  <div className="appoint-title">{t('adminUsers.appointHeading', { group })}</div>
                </div>
              </div>
              <div className="search-field">
                <span aria-hidden>{IC_SEARCH}</span>
                <input
                  type="search"
                  placeholder={t('adminUsers.searchPlaceholder', { group })}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label={t('adminUsers.searchAria', { group })}
                />
              </div>
              {q.trim() && (
                <div className="cand-list" role="listbox">
                  {candidates.length === 0 ? (
                    <div className="ar-empty">{t('adminUsers.noCandidates')}</div>
                  ) : (
                    <>
                      <div className="cand-cap">{t('adminUsers.candidatesCap', { n: candidates.length })}</div>
                      {candidates.map((u) => {
                        const cur = groupOf(u)
                        return (
                          <div className="cand" key={u.sub} role="option" aria-selected="false">
                            <span className="av" aria-hidden>
                              {initials(u.fullName ?? u.email ?? u.sub)}
                            </span>
                            <span className="cand-who">
                              <span className="nm">
                                {u.fullName ?? (isUuidSub(u.sub) ? t('adminUsers.unnamed') : u.sub)}
                                {cur && (
                                  <span className="cand-cur" lang="en">
                                    {t('adminUsers.currentGroup', { group: cur })}
                                  </span>
                                )}
                              </span>
                              <span className="em">{u.email ?? u.sub}</span>
                            </span>
                            <button
                              type="button"
                              className={cur ? 'btn secondary sm cand-move' : 'btn primary sm'}
                              aria-label={t(cur ? 'adminUsers.moveAria' : 'adminUsers.addAria', {
                                name: u.fullName ?? u.sub,
                                group,
                              })}
                              onClick={() => requestAssign(u)}
                            >
                              {cur ? IC_ARROW : IC_PLUS}
                              {cur ? t('adminUsers.move') : t('adminUsers.add')}
                            </button>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {members.length === 0 ? (
            <div className="card">
              <div className="empty">
                <span className="empty-ic" aria-hidden>
                  {IC_USERS}
                </span>
                <div className="empty-title">
                  {isAll ? (
                    t('adminUsers.allEmpty')
                  ) : (
                    <>
                      {t('adminUsers.emptyPrefix')}
                      <b lang="en">{group}</b>
                    </>
                  )}
                </div>
                {!isAll && <div className="empty-help">{t('adminUsers.emptySuffix')}</div>}
              </div>
            </div>
          ) : (
            <div className="card mcard">
              <ul className="mlist">
                {members.map((u) => (
                  <li className="mrow" key={u.sub}>
                    <span className="av" aria-hidden>
                      {initials(u.fullName ?? u.email ?? u.sub)}
                    </span>
                    <span className="mr-who">
                      <span className="nm">{u.fullName ?? (isUuidSub(u.sub) ? t('adminUsers.unnamed') : u.sub)}</span>
                      {(() => {
                        // Dòng phụ + mã: chỉ hiện khi có email/PMH-ID thật — ẩn UUID thô.
                        const secondary = u.email ?? (isUuidSub(u.sub) ? null : u.sub)
                        return secondary ? <span className="em">{secondary}</span> : null
                      })()}
                    </span>
                    {!isUuidSub(u.sub) && <span className="mr-id">{u.sub}</span>}
                    {isAll ? (
                      <span className="mr-tags">
                        <span
                          className={u.hasAccount ? 'pill ok' : 'pill watch'}
                          title={t(u.hasAccount ? 'adminUsers.rosterAccountHint' : 'adminUsers.rosterNoAccountHint')}
                        >
                          {u.hasAccount ? t('adminUsers.rosterHasAccount') : t('adminUsers.rosterNoAccount')}
                        </span>
                        <span
                          className={groupOf(u) ? 'role-chip' : 'role-chip plain'}
                          lang="en"
                          title={t('adminUsers.roleColHint')}
                        >
                          {groupOf(u) ?? ROLE.Applicant}
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost sm mr-rm"
                        aria-label={t('adminUsers.removeAria', { name: u.fullName ?? u.sub, group })}
                        onClick={() => void remove(u)}
                      >
                        {IC_X}
                        {t('adminUsers.remove')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {pendingAdmin && (
        <ConfirmModal
          title={t('adminUsers.appoint.confirmTitle')}
          message={t('adminUsers.appoint.confirmMessage')}
          code={pendingAdmin.fullName ?? pendingAdmin.sub}
          danger
          confirmLabel={t('adminUsers.appoint.confirmLabel')}
          onConfirm={async () => {
            const u = pendingAdmin
            setPendingAdmin(null)
            await assign(u, ROLE.Admin)
          }}
          onCancel={() => setPendingAdmin(null)}
        />
      )}
    </section>
  )
}
