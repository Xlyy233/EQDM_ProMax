import type { RecordType } from '@/types'

const USER_TEMPLATES_KEY = 'eqdm_user_templates'

export interface RecordTemplate {
  id: string
  name: string
  content: string
  type: RecordType
  frequency: number
}

export interface Template {
  id: string
  name: string
  type: RecordType
  description: string
  reason: string
  method: string
  createdAt: string
  updatedAt: string
  frequency: number
}

// 获取所有用户自定义模板
export function getUserTemplates(): Template[] {
  try {
    const data = localStorage.getItem(USER_TEMPLATES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// 保存用户模板到列表
function saveUserTemplates(templates: Template[]) {
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates))
}

// 添加用户模板
export function addUserTemplate(data: { name: string; type: RecordType; description: string; reason: string; method: string }): Template {
  const templates = getUserTemplates()
  const now = new Date().toLocaleString()
  const tpl: Template = {
    id: `user_${Date.now()}`,
    name: data.name,
    type: data.type,
    description: data.description,
    reason: data.reason,
    method: data.method,
    frequency: 0,
    createdAt: now,
    updatedAt: now
  }
  templates.unshift(tpl)
  saveUserTemplates(templates)
  return tpl
}

// 更新用户模板
export function updateUserTemplate(id: string, data: { name: string; type: RecordType; description: string; reason: string; method: string }) {
  const templates = getUserTemplates()
  const idx = templates.findIndex(t => t.id === id)
  if (idx === -1) return
  templates[idx] = {
    ...templates[idx],
    name: data.name,
    type: data.type,
    description: data.description,
    reason: data.reason,
    method: data.method,
    updatedAt: new Date().toLocaleString()
  }
  saveUserTemplates(templates)
}

// 删除用户模板
export function deleteUserTemplate(id: string) {
  const templates = getUserTemplates().filter(t => t.id !== id)
  saveUserTemplates(templates)
}

// 增加模板使用频率
export function updateTemplateFrequency(id: string) {
  const templates = getUserTemplates()
  const idx = templates.findIndex(t => t.id === id)
  if (idx >= 0) {
    templates[idx].frequency = (templates[idx].frequency || 0) + 1
    saveUserTemplates(templates)
  }
}

// 获取按类型筛选的模板（合并用户模板）
export function getTemplatesByType(type: RecordType | 'all'): Template[] {
  const userTpls = getUserTemplates()
  const filtered = type === 'all' ? userTpls : userTpls.filter(t => t.type === type)
  return filtered.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
}

// 将模板格式化填充到记录表单内容
export function formatTemplateContent(tpl: Template): string {
  return `描述：${tpl.description}\n原因：${tpl.reason}\n方法：${tpl.method}`
}

export const getProcessResultOptions = () => [
  { value: 'fixed', label: '已修复' },
  { value: 'observing', label: '待观察' },
  { value: 'needs_parts', label: '需更换配件' },
  { value: 'unrepairable', label: '无法修复' }
]

export const getRecordTypeOptions = () => [
  { value: 'repair', label: '维修' },
  { value: 'maintenance', label: '保养' },
  { value: 'inspection', label: '巡检' },
  { value: 'improvement', label: '改善' }
]

export function getRecentEquipments(): { id: string; code: string; name: string }[] {
  try {
    const data = localStorage.getItem('eqdm_recent_equipments')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveRecentEquipment(equipment: { id: string; code: string; name: string }) {
  const list = getRecentEquipments().filter(e => e.id !== equipment.id)
  list.unshift({ id: equipment.id, code: equipment.code, name: equipment.name })
  if (list.length > 5) list.pop()
  localStorage.setItem('eqdm_recent_equipments', JSON.stringify(list))
}

export function generateAutoTitle(equipmentName: string, recordType: RecordType): string {
  const typeMap: Record<RecordType, string> = {
    repair: '维修',
    maintenance: '保养',
    inspection: '巡检',
    improvement: '改善'
  }
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `${equipmentName} ${typeMap[recordType]} ${dateStr}`
}