import { apiGet } from '../../shared/api-client'

export interface StationNode {
  status: string
  count: number
  overdueCount: number
  overSla: boolean
}
export interface FlowLine {
  flow: string
  total: number
  stations: StationNode[]
}
export interface StationTicket {
  id: string
  code: string | null
  contractor: string | null
  flow: string
  overdueDays: number
}

export const getDispatchMap = () => apiGet<FlowLine[]>('/dispatch-map')
export const getStationTickets = (status: string, flow?: string) =>
  apiGet<StationTicket[]>(
    `/stations/${encodeURIComponent(status)}/tickets${flow ? `?flow=${encodeURIComponent(flow)}` : ''}`,
  )
