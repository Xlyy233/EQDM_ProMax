import request from '@/utils/request'
import { getToken } from '@/stores/user'

export interface FileShare {
  id: string
  name: string
  size: number
  uploadTime: string
  category: string
  deviceCode: string
  deviceName: string
  description: string
  uploader: string
  downloadCount: number
}

export interface FileListResponse {
  files: FileShare[]
}

export async function getFileList(): Promise<FileListResponse> {
  const res = await request.get('/files')
  return res.data
}

export async function uploadFile(formData: FormData): Promise<{ code: number; data: { count: number }; message: string }> {
  const res = await request.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.data
}

export async function deleteFile(filename: string): Promise<void> {
  await request.delete(`/files/${encodeURIComponent(filename)}`)
}

export async function batchDeleteFiles(names: string[]): Promise<void> {
  await request.post('/files/batch-delete', { names })
}

export function getDownloadUrl(filename: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return `${base}/api/files/download/${encodeURIComponent(filename)}`
}

export async function downloadFileWithAuth(filename: string): Promise<Blob> {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const token = getToken()
  const res = await fetch(`${base}/api/files/download/${encodeURIComponent(filename)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error('下载失败')
  return res.blob()
}

export async function batchDownloadFiles(names: string[]): Promise<Blob> {
  const res = await request.post('/files/batch-download', { names }, { responseType: 'blob' })
  return res.data as Blob
}