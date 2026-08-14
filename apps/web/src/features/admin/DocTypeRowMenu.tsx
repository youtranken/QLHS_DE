import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Eye, EyeOff, MoreHorizontal, Trash2 } from 'lucide-react'
import type { AdminDocType } from './api'
import { t } from '../../i18n'

/** ⋯ menu chung cho cả chip (General/Payment) lẫn dòng bảng ma trận (Contract):
 *  ẩn/bật lại + xoá-khi-usedBy=0. Modal xác nhận xoá do component cha giữ. */
export function DocTypeRowMenu({
  d,
  onToggleActive,
  onRequestDelete,
}: {
  d: AdminDocType
  onToggleActive: (d: AdminDocType) => void
  onRequestDelete: (d: AdminDocType) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="dt-menu-btn"
          aria-label={t('adminOptions.docTypes.menuAria', { value: d.value })}
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        {/* Keep focus on the modal that opens from a menu item — let ConfirmModal's
            own autofocus win instead of Radix returning it to the ⋯. */}
        <DropdownMenu.Content
          className="dt-menu"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenu.Item className="dt-mi" onSelect={() => onToggleActive(d)}>
            {d.active ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
            {t(d.active ? 'adminOptions.docTypes.hide' : 'adminOptions.docTypes.unhide')}
          </DropdownMenu.Item>
          {d.usedBy === 0 ? (
            <DropdownMenu.Item className="dt-mi danger" onSelect={() => onRequestDelete(d)}>
              <Trash2 size={14} aria-hidden />
              {t('adminOptions.docTypes.delete')}
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Label className="dt-mi-note">
              {t('adminOptions.docTypes.deleteBlocked', { n: d.usedBy })}
            </DropdownMenu.Label>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
