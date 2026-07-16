import request from '@/utils/request'
import type { ApiResponse, EquipmentAttachment } from '@/types'

export function getAttachments(equipmentId: string): Promise<ApiResponse<EquipmentAttachment[]>> {
  return request.get(`/attachments/equipment/${equipmentId}`).then(r => r.data)
}

export function getBatchAttachments(equipmentIds: string[]): Promise<ApiResponse<Record<string, EquipmentAttachment[]>>> {
  return request.post('/attachments/equipment/batch', { equipmentIds }).then(r => r.data)
}

export function uploadAttachment(equipmentId: string, files: File[]): Promise<ApiResponse<EquipmentAttachment[]>> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  return request.post(`/attachments/equipment/${equipmentId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export function deleteAttachment(id: string): Promise<ApiResponse<null>> {
  return request.delete(`/attachments/${id}`).then(r => r.data)
}

export function getAttachmentUrl(equipmentId: string, fileName: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return base + '/uploads/equipment/' + equipmentId + '/' + fileName
}

// 获取附件预览/下载链接（直接走静态文件服务，不需要认证，适用于window.open）
// 文件名随机生成无法猜测，仅登录用户能获取链接，安全
export function getAttachmentPreviewUrl(equipmentId: string, fileName: string): string {
  return getAttachmentUrl(equipmentId, fileName)
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}