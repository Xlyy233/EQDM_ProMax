import request from '@/utils/request'
import type { ApiResponse, PaginatedResponse } from '@/types'

export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  targetUrl: string
  read: boolean
  createdAt: string
}

export interface UnreadResult {
  list: NotificationItem[]
  unreadCount: number
}

export interface NotificationListResult extends PaginatedResponse<NotificationItem> {
  unreadCount: number
}

export async function getUnread(): Promise<ApiResponse<UnreadResult>> {
  const res = await request.get('/notifications/unread')
  return res.data
}

export async function getNotifications(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<NotificationListResult>> {
  const res = await request.get('/notifications', { params })
  return res.data
}

export async function markRead(id: string): Promise<ApiResponse<void>> {
  const res = await request.put(`/notifications/${id}/read`)
  return res.data
}

export async function markAllRead(): Promise<ApiResponse<void>> {
  const res = await request.put('/notifications/read-all')
  return res.data
}