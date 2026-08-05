import { apiGet, apiPost } from '../../shared/api-client'

export interface NotificationItem {
  id: string
  ticketId: string
  code: string | null
  kind: string
  createdAt: string
  read: boolean
}
export interface NotificationList {
  items: NotificationItem[]
  unread: number
}

export const getNotifications = () => apiGet<NotificationList>('/notifications')
export const markAllRead = () => apiPost<{ ok: true }>('/notifications/read')
export const markOneRead = (id: string) => apiPost<{ ok: true }>(`/notifications/${id}/read`)
