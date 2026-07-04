import request from '@/utils/request'
import type { Equipment, PaginatedResponse, ApiResponse } from '@/types'

export interface EquipmentListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department?: string
  status?: string
}

export async function getEquipments(params?: EquipmentListParams): Promise<ApiResponse<PaginatedResponse<Equipment>>> {
  const res = await request.get('/equipments', { params })
  return res.data
}

export async function getEquipmentById(id: string): Promise<ApiResponse<Equipment>> {
  const res = await request.get(`/equipments/${id}`)
  return res.data
}

export async function getEquipmentByQrcode(qrcode: string): Promise<ApiResponse<Equipment>> {
  const res = await request.get('/equipments/qrcode', { params: { qrcode } })
  return res.data
}

export async function addEquipment(data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Equipment>> {
  const res = await request.post('/equipments', data)
  return res.data
}

export async function updateEquipment(id: string, data: Partial<Equipment>): Promise<ApiResponse<Equipment>> {
  const res = await request.put(`/equipments/${id}`, data)
  return res.data
}

export async function deleteEquipment(id: string): Promise<ApiResponse<void>> {
  const res = await request.delete(`/equipments/${id}`)
  return res.data
}

export async function deleteAllEquipments(): Promise<ApiResponse<void>> {
  const res = await request.delete('/equipments/all')
  return res.data
}

export async function getDepartments(): Promise<ApiResponse<string[]>> {
  const res = await request.get('/equipments/departments')
  return res.data
}

export async function batchAddEquipment(dataList: Equipment[]): Promise<ApiResponse<void>> {
  const res = await request.post('/equipments/batch', dataList)
  return res.data
}

export async function getEquipmentTypes(): Promise<ApiResponse<string[]>> {
  const res = await request.get('/equipments/types')
  return res.data
}

export async function batchUpdateTypes(updates: { id: string; type: string }[]): Promise<ApiResponse<{ count: number }>> {
  const res = await request.put('/equipments/batch-types', { updates })
  return res.data
}
