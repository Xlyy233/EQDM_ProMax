export type EquipmentStatus = 'in_use' | 'stopped' | 'scrapped'
export type RecordType = 'repair' | 'maintenance' | 'inspection' | 'improvement'
export type RecordStatus = 'completed' | 'approved' | 'pending'
export type UserRole = 'employee' | 'manager' | 'admin'
export type MaintenanceCycleType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type MaintenancePlanStatus = 'active' | 'paused' | 'completed'

export interface Equipment {
  id: string
  code: string
  name: string
  model: string
  purchaseDate: string
  department: string
  location: string
  status: EquipmentStatus
  qrcode: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  keyEquipment?: string
  productionLineCode?: string
  factoryCode?: string
  assetType?: string
  assetStatus?: string
  brand?: string
  quantity?: string
  enableDate?: string
  factoryDate?: string
  ratedPower?: string
  useLocation?: string
  departmentName?: string
}

export interface WorkRecord {
  id: string
  equipmentId: string
  equipmentName: string
  type: RecordType
  title: string
  content: string
  startTime: string
  endTime: string
  result: string
  remark: string
  photos: string[]
  status: RecordStatus
  personnel: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  isStopped: 'yes' | 'no'
  stopDuration: string
  stopDurationUnit: 'minutes' | 'hours'
}

export interface User {
  id: string
  username: string
  realName: string
  role: UserRole
  department: string
  createdAt: string
  updatedAt: string
}

export interface MaintenancePlan {
  id: string
  equipmentId: string
  equipmentName: string
  equipmentCode: string
  planName: string
  cycleType: MaintenanceCycleType
  cycleValue: number
  lastMaintenanceDate: string
  nextMaintenanceDate: string
  responsibleUserId: string
  responsibleUserName: string
  status: MaintenancePlanStatus
  remark: string
  createdAt: string
  updatedAt: string
}

export interface DashboardData {
  totalEquipments: number
  inUseCount: number
  stoppedCount: number
  scrappedCount: number
  monthlyRepairCount: number
  monthlyMaintenanceCount: number
  monthlyInspectionCount: number
  mttr: number
  availabilityRate: number
  pendingRecords: number
  completedRecords: number
}

export interface TrendData {
  date: string
  repair: number
  maintenance: number
  inspection: number
  improvement: number
}

export interface StatisticsData {
  monthlyFailureRate: number
  monthlyRecords: { repair: number; maintenance: number; inspection: number; improvement: number }
  equipmentFailureRates: Array<{ equipmentId: string; equipmentName: string; failureRate: number; repairCount: number; inspectionCount: number }>
  vulnerableParts: Array<{ partName: string; replaceCount: number; equipmentCount: number; equipmentList: string[] }>
}

export interface EquipmentKPI {
  equipmentId: string
  equipmentName: string
  mtbf: number
  mttr: number
  availabilityRate: number
  totalRepairCost: number
  repairCount: number
  maintenanceCount: number
}

export interface DepartmentStats {
  department: string
  equipmentCount: number
  repairCount: number
  maintenanceCount: number
  failureRate: number
}

export interface CostAnalysis {
  totalCost: number
  laborCost: number
  partsCost: number
  otherCost: number
  monthlyCosts: Array<{ month: string; cost: number }>
}

export interface PieChartData {
  name: string
  value: number
  color: string
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export const statusMap: Record<EquipmentStatus, string> = { in_use: '在用', stopped: '停用', scrapped: '报废' }
export const recordTypeMap: Record<RecordType, string> = { repair: '维修', maintenance: '保养', inspection: '巡检', improvement: '改善' }
export const recordStatusMap: Record<RecordStatus, string> = { completed: '已完成', approved: '已审核', pending: '待处理' }
export const roleMap: Record<UserRole, string> = { employee: '普通员工', manager: '部门经理', admin: '系统管理员' }
export const cycleTypeMap: Record<MaintenanceCycleType, string> = { daily: '每天', weekly: '每周', monthly: '每月', quarterly: '每季度', yearly: '每年' }
export const maintenanceStatusMap: Record<MaintenancePlanStatus, string> = { active: '进行中', paused: '已暂停', completed: '已完成' }
