import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, logout } from '@/stores/user'
import router from '@/router'
import type { ApiResponse } from '@/types'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

let isRedirectingToLogin = false

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.code === 401 && !isRedirectingToLogin) {
      isRedirectingToLogin = true
      ElMessage.error('登录已过期，请重新登录')
      logout()
      router.push('/login')
      // 重置标记，防止重复跳转
      setTimeout(() => { isRedirectingToLogin = false }, 3000)
      return Promise.reject(new Error('Unauthorized'))
    }
    return response
  },
  (error) => {
    // 避免在登录页显示错误提示
    if (error.response?.status === 401 && router.currentRoute.value.path === '/login') {
      return Promise.reject(error)
    }
    console.error('Request error:', error)
    const msg = error.response?.data?.message || error.message || '网络错误，请重试'
    ElMessage.error(msg)
    return Promise.reject(error)
  }
)

export default request
