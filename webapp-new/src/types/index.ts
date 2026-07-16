export type EquipmentStatus = 'in_use' | 'stopped' | 'scrapped'
export type RecordType = 'repair' | 'maintenance' | 'inspection' | 'improvement'
export type RecordStatus = 'completed' | 'approved' | 'pending'
export type UserRole = 'employee' | 'manager' | 'admin' | 'maintenance_leader' | 'inspection_leader' | 'coordinator'
export type MaintenanceCycleType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type MaintenancePlanStatus = 'active' | 'paused' | 'completed'

export interface EquipmentAttachment {
  id: string
  equipmentId: string
  originalName: string
  fileName: string
  mimeType: string
  size: number
  createdBy: string
  createdAt: string
}

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
  equipmentCode: string
  equipmentName: string
  type: RecordType
  title: string
  content: string
  faultDescription: string
  faultCause: string
  solution: string
  startTime: string
  endTime: string
  result: string
  remark: string
  photos: string[]
  afterPhotos: string[]
  status: RecordStatus
  personnel: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  isStopped: 'yes' | 'no'
  stopDuration: string
  stopDurationUnit: 'minutes' | 'hours'
  partsReplaced: 'yes' | 'no'
  partsReplacedDetail: string
  consumedParts: ConsumedPart[]
}

export interface ConsumedPart {
  sparePartId: string
  sparePartName: string
  quantity: number
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
  responsibleUserIds: string[]
  responsibleUserNames: string[]
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
  mtbf: number
  availabilityRate: number
  maintenanceRate: number
  pendingRecords: number
  completedRecords: number
  lastMonthRepairCount: number
  lowStockParts: LowStockPart[]
}

export interface LowStockPart {
  id: string
  name: string
  spec: string
  quantity: number
  minStock: number
  unit: string
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

// 预测性分析类型
export interface HealthScore {
  equipmentId: string
  equipmentName: string
  equipmentCode: string
  score: number
  riskLevel: 'high' | 'medium' | 'low'
  repairCount: number
  inspectionFailRate: number
  ageDays: number
  partsCount: number
  maintenanceCompliance: number
  maintenanceOverdue: number
}

export interface HighRiskEquipment extends HealthScore {
  repairTrend: string
  topFailItems: string[]
}

export interface RepairTrend {
  equipmentId: string
  equipmentName: string
  monthly: number[]
  trend: string
}

export interface OverduePlan {
  equipmentId: string
  equipmentName: string
  planName: string
  nextMaintenanceDate: string
  overdueDays: number
}

export interface UpcomingPlan {
  equipmentId: string
  equipmentName: string
  planName: string
  nextMaintenanceDate: string
  daysUntil: number
}

export interface IneffectiveMaintenance {
  equipmentId: string
  equipmentName: string
  maintenanceDate: string
  repairAfterCount: number
  minDaysToRepair: number
}

export interface CycleSuggestion {
  equipmentId: string
  equipmentName: string
  planName: string
  currentCycleDays: number
  suggestedCycleDays: number
  avgRepairGapDays: number
}

export interface MaintenanceAnalysis {
  complianceRate: number
  overduePlans: OverduePlan[]
  upcomingPlans: UpcomingPlan[]
  ineffectiveMaintenances: IneffectiveMaintenance[]
  cycleSuggestions: CycleSuggestion[]
}

export interface PartsPrediction {
  partName: string
  avgCycleDays: number
  lastReplaceDate: string
  predictedNext: string
  daysUntil: number
  priority: string
}

export interface Suggestion {
  type: string
  title: string
  content: string
  equipmentId: string
  equipmentName: string
}

export interface PredictiveData {
  healthScores: HealthScore[]
  highRiskEquipments: HighRiskEquipment[]
  repairTrends: RepairTrend[]
  maintenanceAnalysis: MaintenanceAnalysis
  partsPredictions: PartsPrediction[]
  suggestions: Suggestion[]
}

export interface PartsReplacementData {
  totalReplacements: number
  partsList: Array<{ equipmentName: string; equipmentId: string; detail: string; date: string; type: string }>
  partsStats: Array<{ name: string; count: number }>
  equipmentStats: Array<{ name: string; count: number; details: string[] }>
}

export interface SparePart {
  id: string
  name: string
  spec: string
  quantity: number
  minStock: number
  unit: string
  location: string
  equipmentId: string
  equipmentName: string
  remark: string
  createdAt: string
  updatedAt: string
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
export const roleMap: Record<UserRole, string> = { employee: '普通员工', manager: '部门经理', admin: '系统管理员', maintenance_leader: '维修负责人', inspection_leader: '保养巡检负责人', coordinator: '总协调主管' }
export const cycleTypeMap: Record<MaintenanceCycleType, string> = { daily: '每天', weekly: '每周', monthly: '每月', quarterly: '每季度', yearly: '每年' }
export const maintenanceStatusMap: Record<MaintenancePlanStatus, string> = { active: '进行中', paused: '已暂停', completed: '已完成' }

// ========== 巡检类型 ==========

export interface InspectionItem {
  id: string
  content: string
  order: number
}

export interface InspectionTemplate {
  id: string
  name: string
  equipmentType: string
  items: InspectionItem[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface InspectionResultItem {
  id: string
  content: string
  checked: boolean
  remark: string
}

export interface InspectionRecord {
  id: string
  templateId: string
  templateName: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  inspector: string
  inspectionDate: string
  items: InspectionResultItem[]
  photos: string
  afterPhotos: string
  status: string
  remark: string
  createdAt: string
}

// ========== 公告类型 ==========

export interface Announcement {
  id: string
  title: string
  content: string
  isActive: boolean
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}
