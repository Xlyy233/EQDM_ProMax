import request from '@/utils/request'
import type { WorkRecord, PaginatedResponse, ApiResponse, StatisticsData } from '@/types'

export interface RecordListParams {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  equipmentId?: string
  createdBy?: string
  startTime?: string
  endTime?: string
}

export async function getRecords(params?: RecordListParams): Promise<ApiResponse<PaginatedResponse<WorkRecord>>> {
  const res = await request.get('/records', { params })
  return res.data
}

export async function getRecordById(id: string): Promise<ApiResponse<WorkRecord>> {
  const res = await request.get(`/records/${id}`)
  return res.data
}

export async function addRecord(data: Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<WorkRecord>> {
  const res = await request.post('/records', data)
  return res.data
}

export async function updateRecord(id: string, data: Partial<WorkRecord>): Promise<ApiResponse<WorkRecord>> {
  const res = await request.put(`/records/${id}`, data)
  return res.data
}

export async function deleteRecord(id: string): Promise<ApiResponse<void>> {
  const res = await request.delete(`/records/${id}`)
  return res.data
}

export async function getRecordStats(startTime: string, endTime: string): Promise<ApiResponse<StatisticsData>> {
  const res = await request.get('/records/stats', { params: { startTime, endTime } })
  return res.data
}

// Export Excel via browser download
export async function exportRecordsExcel(startTime: string, endTime: string, filename: string): Promise<void> {
  const { getToken } = await import('@/stores/user')
  const token = getToken()

  const url = `/api/export-excel/records?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
  const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: '导出失败' }))
    throw new Error(err.message || '导出失败')
  }
  const blob = await response.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(downloadUrl)
}
