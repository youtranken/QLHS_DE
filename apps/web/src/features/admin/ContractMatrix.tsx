import { Check } from 'lucide-react'
import { DocTypeRowMenu } from './DocTypeRowMenu'
import type { AdminDocType } from './api'
import { t } from '../../i18n'

type CapKey = 'requiresContractNo' | 'allowSkip'

/** Bảng ma trận cho luồng Contract: mỗi loại 1 dòng, 2 cột checkbox (Contract No ·
 *  Skip) — quản lý gọn khi danh mục Contract phình to (khác chip General/Payment).
 *  Ẩn/xoá vẫn qua ⋯ như chip; cột "Dùng" = số hồ sơ đang tham chiếu. */
export function ContractMatrix({
  types,
  onToggleCap,
  onToggleActive,
  onRequestDelete,
}: {
  types: AdminDocType[]
  onToggleCap: (d: AdminDocType, key: CapKey, next: boolean) => void
  onToggleActive: (d: AdminDocType) => void
  onRequestDelete: (d: AdminDocType) => void
}) {
  return (
    <div className="dt-group dt-group-matrix">
      <span className="dt-flow" lang="en">
        Contract
      </span>
      <div className="dt-matrix-scroll">
        <table className="dt-matrix">
          <thead>
            <tr>
              <th scope="col">{t('adminOptions.docTypes.matrix.type')}</th>
              <th scope="col" className="dt-mx-cap">
                {t('adminOptions.docTypes.matrix.contractNo')}
              </th>
              <th scope="col" className="dt-mx-cap">
                {t('adminOptions.docTypes.matrix.skip')}
              </th>
              <th scope="col" className="dt-mx-used">
                {t('adminOptions.docTypes.matrix.used')}
              </th>
              <th scope="col">
                <span className="sr-only">{t('adminOptions.docTypes.matrix.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((d) => (
              <tr key={d.id} className={d.active ? undefined : 'off'}>
                <td className="dt-mx-name">
                  <span lang="en">{d.value}</span>
                  {!d.active && (
                    <span className="dt-off-pill">{t('adminOptions.docTypes.hiddenChip')}</span>
                  )}
                </td>
                <td className="dt-mx-cap">
                  <CapBox
                    on={d.requiresContractNo}
                    label={t('adminOptions.docTypes.matrix.contractNoAria', { value: d.value })}
                    onToggle={(next) => onToggleCap(d, 'requiresContractNo', next)}
                  />
                </td>
                <td className="dt-mx-cap">
                  <CapBox
                    on={d.allowSkip}
                    label={t('adminOptions.docTypes.matrix.skipAria', { value: d.value })}
                    onToggle={(next) => onToggleCap(d, 'allowSkip', next)}
                  />
                </td>
                <td className="dt-mx-used">{d.usedBy}</td>
                <td className="dt-mx-menu">
                  <DocTypeRowMenu d={d} onToggleActive={onToggleActive} onRequestDelete={onRequestDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Checkbox vẽ tay (native ẩn) khớp phong cách .skipbox ở modal — nhấn cả ô. */
function CapBox({ on, label, onToggle }: { on: boolean; label: string; onToggle: (next: boolean) => void }) {
  return (
    <label className={`dt-cap${on ? ' on' : ''}`}>
      <input type="checkbox" checked={on} aria-label={label} onChange={(e) => onToggle(e.target.checked)} />
      <span className="dt-cap-box" aria-hidden>
        <Check size={13} strokeWidth={3} />
      </span>
    </label>
  )
}
