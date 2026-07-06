import request from '@/utils/request'
import type { StatisticsData, DashboardData, TrendData, EquipmentKPI, DepartmentStats, CostAnalysis, PieChartData, PartsReplacementData, PredictiveData, ApiResponse } from '@/types'

export async function getStatistics(year: number, month: number): Promise<ApiResponse<StatisticsData>> {
  const res = await request.get('/statistics/monthly', { params: { year, month } })
  return res.data
}

export async function getDashboardOverview(): Promise<ApiResponse<DashboardData>> {
  const res = await request.get('/statistics/dashboard')
  return res.data
}

export async function getTrendData(days: number): Promise<ApiResponse<TrendData[]>> {
  const res = await request.get('/statistics/trend', { params: { days } })
  return res.data
}

export async function getEquipmentKPI(equipmentId: string): Promise<ApiResponse<EquipmentKPI>> {
  const res = await request.get(`/statistics/equipment-kpi/${equipmentId}`)
  return res.data
}

export async function getDepartmentStats(): Promise<ApiResponse<DepartmentStats[]>> {
  const res = await request.get('/statistics/department')
  return res.data
}

export async function getCostAnalysis(months: number): Promise<ApiResponse<CostAnalysis>> {
  const res = await request.get('/statistics/cost', { params: { months } })
  return res.data
}

export async function getRecordTypeDistribution(): Promise<ApiResponse<PieChartData[]>> {
  const res = await request.get('/statistics/record-type-distribution')
  return res.data
}

export async function getPartsReplacement(): Promise<ApiResponse<PartsReplacementData>> {
  const res = await request.get('/statistics/parts-replacement')
  return res.data
}

export async function getPredictiveAnalysis(): Promise<ApiResponse<PredictiveData>> {
  const res = await request.get('/statistics/predictive')
  return res.data
}
