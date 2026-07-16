import request from '@/utils/request'
import type { SparePart, ApiResponse } from '@/types'

export interface SparePartListResponse {
  list: SparePart[]
  total: number
  page: number
  pageSize: number
}

export async function getSpareParts(params: {
  keyword?: string
  lowStock?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<SparePartListResponse>> {
  const res = await request.get('/spare-parts', { params })
  return res.data
}

export async function getLowStockSpareParts(): Promise<ApiResponse<{ list: SparePart[]; total: number }>> {
  const res = await request.get('/spare-parts/low-stock')
  return res.data
}

export async function getSparePart(id: string): Promise<ApiResponse<SparePart>> {
  const res = await request.get(`/spare-parts/${id}`)
  return res.data
}

export async function createSparePart(data: Partial<SparePart>): Promise<ApiResponse<SparePart>> {
  const res = await request.post('/spare-parts', data)
  return res.data
}

export async function updateSparePart(id: string, data: Partial<SparePart>): Promise<ApiResponse<SparePart>> {
  const res = await request.put(`/spare-parts/${id}`, data)
  return res.data
}

export async function stockIn(id: string, amount: number, remark?: string): Promise<ApiResponse<SparePart>> {
  const res = await request.put(`/spare-parts/${id}/stock-in`, { amount, remark })
  return res.data
}

export async function stockOut(id: string, amount: number, remark?: string): Promise<ApiResponse<SparePart>> {
  const res = await request.put(`/spare-parts/${id}/stock-out`, { amount, remark })
  return res.data
}

export async function deleteSparePart(id: string): Promise<ApiResponse<null>> {
  const res = await request.delete(`/spare-parts/${id}`)
  return res.data
}