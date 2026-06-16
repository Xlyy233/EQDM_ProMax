import request from '@/utils/request'
import type { MaintenancePlan, PaginatedResponse, ApiResponse } from '@/types'

export interface MaintenanceListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  equipmentId?: string
}

export async function getPlans(params?: MaintenanceListParams): Promise<ApiResponse<PaginatedResponse<MaintenancePlan>>> {
  const res = await request.get('/maintenance-plans', { params })
  return res.data
}

export async function getPlanById(id: string): Promise<ApiResponse<MaintenancePlan>> {
  const res = await request.get(`/maintenance-plans/${id}`)
  return res.data
}

export async function addPlan(data: Partial<MaintenancePlan>): Promise<ApiResponse<MaintenancePlan>> {
  const res = await request.post('/maintenance-plans', data)
  return res.data
}

export async function updatePlan(id: string, data: Partial<MaintenancePlan>): Promise<ApiResponse<MaintenancePlan>> {
  const res = await request.put(`/maintenance-plans/${id}`, data)
  return res.data
}

export async function deletePlan(id: string): Promise<ApiResponse<void>> {
  const res = await request.delete(`/maintenance-plans/${id}`)
  return res.data
}

export async function getUpcomingPlans(days: number): Promise<ApiResponse<MaintenancePlan[]>> {
  const res = await request.get('/maintenance-plans/upcoming', { params: { days } })
  return res.data
}

export async function completePlan(id: string): Promise<ApiResponse<MaintenancePlan>> {
  const res = await request.post(`/maintenance-plans/${id}/complete`)
  return res.data
}
