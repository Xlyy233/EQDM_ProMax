<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCurrentUser, canManageEquipment, canManageUsers, canViewStatistics, canExportData, canViewLogs, canManageMaintenance, logout } from '@/stores/user'
import { ElMessageBox } from 'element-plus'

const props = defineProps<{ refreshKey?: number }>()
const slots = defineSlots<{ default: () => any }>()

const router = useRouter()
const route = useRoute()
const isMobile = ref(window.innerWidth < 768)
const collapsed = ref(false)

window.addEventListener('resize', () => {
  isMobile.value = window.innerWidth < 768
})

const activeMenu = computed(() => route.path.split('/')[1] || '')
const user = computed(() => getCurrentUser())
const userName = computed(() => user.value?.realName || user.value?.username || '')
const userInitial = computed(() => (userName.value.charAt(0) || '?').toUpperCase())
const userRole = computed(() => {
  const role = user.value?.role
  const map: Record<string, string> = { employee: '普通员工', manager: '部门经理', admin: '系统管理员' }
  return map[role || ''] || ''
})

const menuItems = computed(() => {
  const items = [
    { path: '/', label: '首页', icon: 'HomeFilled' },
    { path: '/equipment', label: '设备台账', icon: 'Box', show: canManageEquipment() },
    { path: '/equipment-qrcode', label: '二维码管理', icon: 'PictureFilled', show: canManageEquipment() },
    { path: '/record', label: '工作记录', icon: 'Document' },
    { path: '/maintenance', label: '保养计划', icon: 'Calendar', show: canManageMaintenance() },
    { path: '/statistics', label: '统计分析', icon: 'DataAnalysis', show: canViewStatistics() },
    { path: '/knowledge', label: '部门知识库', icon: 'Reading', show: true },
    { path: '/export', label: '数据导出', icon: 'Download', show: canExportData() },
    { path: '/user', label: '用户管理', icon: 'User', show: canManageUsers() },
    { path: '/template', label: '常用模板', icon: 'Collection' },
    { path: '/logs', label: '日志管理', icon: 'Tickets', show: canViewLogs() }
  ]
  return items.filter(item => item.show !== false)
})

function handleLogout() {
  ElMessageBox.confirm('确定要退出登录吗？', '确认退出', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    logout()
    router.push('/login')
  }).catch(() => {})
}

function goTo(path: string) {
  router.push(path)
}
</script>

<template>
  <el-container class="app-container" v-if="isMobile">
    <!-- Mobile: header + content -->
    <el-header class="mobile-header gradient-primary" style="height: 60px;">
      <div class="flex items-center justify-between h-full text-white">
        <div class="flex items-center gap-2">
          <el-icon :size="22"><Tools /></el-icon>
          <span class="font-semibold">设备管理系统</span>
        </div>
        <el-dropdown>
          <div class="flex items-center gap-2 cursor-pointer">
            <div class="w-8 h-8 rounded-full bg-white bg-opacity-25 flex items-center justify-center font-semibold">{{ userInitial }}</div>
            <span class="text-sm">{{ userName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ userRole }}</el-dropdown-item>
              <el-dropdown-item divided @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-main class="mobile-main" style="padding: 12px;">
      <slot />
    </el-main>

    <!-- Bottom navigation -->
    <el-footer class="mobile-footer" style="height: 60px; padding: 0;">
      <div class="mobile-nav">
        <div v-for="item in [{ path:'/',label:'首页',icon:'HomeFilled' },{ path:'/equipment',label:'设备',icon:'Box',show:canManageEquipment() },{ path:'/record',label:'记录',icon:'Document' }].filter(i => i.show !== false)"
             :key="item.path"
             class="nav-item"
             :class="{ active: activeMenu === item.path.split('/')[1] }"
             @click="goTo(item.path)">
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span class="text-xs mt-1">{{ item.label }}</span>
        </div>
      </div>
    </el-footer>
  </el-container>

  <el-container v-else class="app-container">
    <!-- Desktop sidebar -->
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar" style="background: #1f2937; transition: width 0.2s;">
      <div class="sidebar-logo gradient-primary text-white flex items-center justify-center" style="height: 60px;">
        <el-icon :size="24" class="mr-2" v-if="!collapsed"><Tools /></el-icon>
        <el-icon :size="24" v-else><Tools /></el-icon>
        <span v-if="!collapsed" class="font-semibold">设备管理系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="#1f2937"
        text-color="#e5e7eb"
        active-text-color="#409EFF"
        :collapse="collapsed"
        router
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path.split('/')[1] || 'home'" @click="goTo(item.path)">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="desktop-header" style="height: 60px; padding: 0 20px;">
        <div class="flex items-center justify-between h-full">
          <div class="flex items-center gap-3">
            <el-icon :size="20" class="cursor-pointer" @click="collapsed = !collapsed"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
            <el-breadcrumb :separator-icon="ArrowRight">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="route.meta.title && route.path !== '/'">{{ route.meta.title }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <el-dropdown>
            <div class="flex items-center gap-3 cursor-pointer">
              <div class="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">{{ userInitial }}</div>
              <div class="flex flex-col text-left">
                <span class="text-sm font-medium">{{ userName }}</span>
                <span class="text-xs text-gray-500">{{ userRole }}</span>
              </div>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main style="padding: 20px;">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
}

.sidebar-menu {
  border-right: none;
}

:deep(.el-menu) { border-right: none; }

.desktop-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.mobile-header {
  padding: 0 12px;
}

.mobile-main {
  background: #f5f7fa;
  min-height: calc(100vh - 120px);
}

.mobile-footer {
  background: #fff;
  border-top: 1px solid #ebeef5;
}

.mobile-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: #606266;
  cursor: pointer;
  transition: color 0.2s;
}

.nav-item.active {
  color: #409EFF;
}
</style>
