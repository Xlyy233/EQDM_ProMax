import request from '@/utils/request'
import type { User, PaginatedResponse, ApiResponse } from '@/types'

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  role?: string
  department?: string
}

export async function loginApi(username: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> {
  const res = await request.post('/auth/login', { username, password })
  return res.data
}

export async function getUsers(params?: UserListParams): Promise<ApiResponse<PaginatedResponse<User>>> {
  const res = await request.get('/users', { params })
  return res.data
}

export async function getUserById(id: string): Promise<ApiResponse<User>> {
  const res = await request.get(`/users/${id}`)
  return res.data
}

export async function addUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<ApiResponse<User>> {
  const res = await request.post('/users', data)
  return res.data
}

export async function updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
  const res = await request.put(`/users/${id}`, data)
  return res.data
}

export async function deleteUser(id: string): Promise<ApiResponse<void>> {
  const res = await request.delete(`/users/${id}`)
  return res.data
}
