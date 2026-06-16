import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { User, UserRole } from '@/types'
import request from '@/utils/request'
import type { ApiResponse } from '@/types'

const STORAGE_KEY_USER = 'eqdm_user_v3'
const STORAGE_KEY_TOKEN = 'eqdm_token_v3'

// 纯模块状态，不使用 Pinia
let _user: User | null = null
let _token: string = ''
let _initialized = false

// 响应式引用（供 Vue 模板使用）
const userRef = ref<User | null>(null)
const tokenRef = ref<string>('')

function _saveToStorage() {
  try {
    if (_user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(_user))
    else localStorage.removeItem(STORAGE_KEY_USER)
    if (_token) localStorage.setItem(STORAGE_KEY_TOKEN, _token)
    else localStorage.removeItem(STORAGE_KEY_TOKEN)
  } catch (e) {}
}

function _loadFromStorage() {
  if (_initialized) return
  _initialized = true
  try {
    const u = localStorage.getItem(STORAGE_KEY_USER)
    if (u) _user = JSON.parse(u)
    const t = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (t) _token = t
    userRef.value = _user
    tokenRef.value = _token
  } catch (e) {
    console.warn('Failed to load user storage', e)
  }
}

// 导出给外部调用的 API
export function loadFromStorage() { _initialized = false; _loadFromStorage() }

export function isLoggedIn(): boolean {
  _loadFromStorage()
  return _user !== null && _token !== ''
}

export function getCurrentUser(): User | null {
  _loadFromStorage()
  return _user
}

export function getToken(): string {
  _loadFromStorage()
  return _token
}

export function getUserRef() {
  _loadFromStorage()
  return { userRef, tokenRef }
}

export function hasRole(role: UserRole | UserRole[]): boolean {
  _loadFromStorage()
  if (!_user) return false
  const roles = Array.isArray(role) ? role : [role]
  return roles.includes(_user.role)
}

// 权限定义（参考老系统）
export function canViewAllRecords(): boolean { return hasRole(['manager', 'admin']) }
export function canExportData(): boolean { return hasRole(['manager', 'admin']) }
export function canViewStatistics(): boolean { return hasRole(['manager', 'admin']) }
export function canManageUsers(): boolean { return hasRole(['admin']) }
export function canManageEquipment(): boolean { return hasRole(['manager', 'admin']) } // 设备管理仅限管理员和部门经理
export function canManageMaintenance(): boolean { return hasRole(['manager', 'admin']) } // 保养计划仅限管理员和部门经理
export function canViewLogs(): boolean { return hasRole(['admin']) }

export async function login(username: string, password: string): Promise<boolean> {
  const res = await request.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { username, password })
  if (res.data.code === 200) {
    _user = res.data.data.user
    _token = res.data.data.token
    userRef.value = _user
    tokenRef.value = _token
    _saveToStorage()
    return true
  }
  ElMessage.error(res.data.message || '登录失败')
  return false
}

export function logout() {
  _user = null
  _token = ''
  userRef.value = null
  tokenRef.value = ''
  _initialized = false
  try {
    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)
  } catch (e) {}
}
