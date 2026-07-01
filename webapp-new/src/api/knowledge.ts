import request from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  summary: string
  category: string
  authorId: string
  author: string
  tags: string[]
  coverImageId: string
  imageIds: string[]
  images?: KnowledgeImage[]
  likeCount: number
  commentCount: number
  liked?: boolean
  createdAt: string
  updatedAt: string
}

export interface KnowledgeImage {
  id: string
  url: string
  originalName: string
}

export interface KnowledgeComment {
  id: string
  knowledgeId: string
  content: string
  authorId: string
  author: string
  createdAt: string
}

export interface PaginatedResult<T> {
  page: number
  pageSize: number
  total: number
  list: T[]
}

export function getKnowledgeList(params: {
  page?: number
  pageSize?: number
  category?: string
  keyword?: string
}): Promise<ApiResponse<PaginatedResult<KnowledgeItem>>> {
  return request.get('/knowledge', { params }).then(r => r.data)
}

export function getKnowledgeDetail(id: string): Promise<ApiResponse<KnowledgeItem>> {
  return request.get(`/knowledge/${id}`).then(r => r.data)
}

export function createKnowledge(data: {
  title: string
  content: string
  summary?: string
  category?: string
  tags?: string[]
  coverImageId?: string
  imageIds?: string[]
}): Promise<ApiResponse<KnowledgeItem>> {
  return request.post('/knowledge', data).then(r => r.data)
}

export function updateKnowledge(id: string, data: {
  title?: string
  content?: string
  summary?: string
  category?: string
  tags?: string[]
  coverImageId?: string
  imageIds?: string[]
}): Promise<ApiResponse<KnowledgeItem>> {
  return request.put(`/knowledge/${id}`, data).then(r => r.data)
}

export function deleteKnowledge(id: string): Promise<ApiResponse<null>> {
  return request.delete(`/knowledge/${id}`).then(r => r.data)
}

export function uploadKnowledgeImages(files: File[]): Promise<ApiResponse<KnowledgeImage[]>> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  return request.post('/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export function toggleLike(id: string): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> {
  return request.post(`/knowledge/${id}/like`).then(r => r.data)
}

export function getComments(knowledgeId: string): Promise<ApiResponse<KnowledgeComment[]>> {
  return request.get(`/knowledge/${knowledgeId}/comments`).then(r => r.data)
}

export function addComment(knowledgeId: string, content: string): Promise<ApiResponse<KnowledgeComment>> {
  return request.post(`/knowledge/${knowledgeId}/comments`, { content }).then(r => r.data)
}

export function deleteComment(commentId: string): Promise<ApiResponse<null>> {
  return request.delete(`/knowledge/comments/${commentId}`).then(r => r.data)
}

export function getImageUrl(url: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return base + url
}