import request from '@/utils/request'
import type { ApiResponse, PaginatedResponse, Announcement } from '@/types'

export function getAnnouncements(params?: { page?: number; pageSize?: number }) {
  return request.get<ApiResponse<PaginatedResponse<Announcement>>>('/announcements', { params })
}

export function getActiveAnnouncement() {
  return request.get<ApiResponse<Announcement | null>>('/announcements/active')
}

export function getAnnouncementById(id: string) {
  return request.get<ApiResponse<Announcement>>('/announcements/' + id)
}

export function createAnnouncement(data: { title: string; content: string; isActive: boolean }) {
  return request.post<ApiResponse<Announcement>>('/announcements', data)
}

export function updateAnnouncement(id: string, data: { title?: string; content?: string; isActive?: boolean }) {
  return request.put<ApiResponse<Announcement>>('/announcements/' + id, data)
}

export function deleteAnnouncement(id: string) {
  return request.delete<ApiResponse<null>>('/announcements/' + id)
}