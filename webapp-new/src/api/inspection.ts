import request from '@/utils/request'

export function getTemplates(params?: any) {
  return request.get('/inspections/templates', { params })
}

export function getTemplate(id: string) {
  return request.get(`/inspections/templates/${id}`)
}

export function createTemplate(data: any) {
  return request.post('/inspections/templates', data)
}

export function updateTemplate(id: string, data: any) {
  return request.put(`/inspections/templates/${id}`, data)
}

export function deleteTemplate(id: string) {
  return request.delete(`/inspections/templates/${id}`)
}

export function getTemplatesByType(equipmentType: string) {
  return request.get(`/inspections/templates/by-type/${encodeURIComponent(equipmentType)}`)
}

export function getRecords(params?: any) {
  return request.get('/inspections/records', { params })
}

export function getRecord(id: string) {
  return request.get(`/inspections/records/${id}`)
}

export function createRecord(data: any) {
  return request.post('/inspections/records', data)
}

export function deleteRecord(id: string) {
  return request.delete(`/inspections/records/${id}`)
}

export function exportRecords(params?: any) {
  return request.get('/inspections/export', { params })
}