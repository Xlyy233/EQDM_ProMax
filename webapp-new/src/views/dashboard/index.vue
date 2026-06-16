<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, canManageEquipment, canManageUsers, canViewStatistics, canExportData, canViewLogs, canViewAllRecords, loadFromStorage, isLoggedIn } from '@/stores/user'
import { recordTypeMap, recordStatusMap, roleMap } from '@/types'
import type { WorkRecord, MaintenancePlan } from '@/types'
import * as recordApi from '@/api/record'
import * as maintenanceApi from '@/api/maintenance'
import * as statisticsApi from '@/api/statistics'
import dayjs from 'dayjs'
import { Camera, Edit, Document, Collection, Box, Download, User, Tickets, Calendar, DataAnalysis, Tools, SetUp, CircleCheck, Grid, Sunny, Moon } from '@element-plus/icons-vue'

const iconMap: Record<string, any> = {
  Camera, Edit, Document, Collection, Box, Download, User, Tickets, Calendar, DataAnalysis, Tools, SetUp, CircleCheck, Grid,
  QrCode: Grid,
  Date: Calendar
}

const router = useRouter()

const userName = ref('')
const userInitial = ref('?')
const userRole = ref('')

// 深色模式切换
const isDark = ref(false)

function toggleDarkMode() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function initDarkMode() {
  const saved = localStorage.getItem('theme')
  isDark.value = saved === 'dark'
  document.documentElement.classList.toggle('dark', isDark.value)
}

const stats = ref([
  { label: '设备总数', value: 0, icon: 'Box', color: '#409EFF', bg: '#E8F4FD' },
  { label: '本月维修', value: 0, icon: 'Tools', color: '#E6A23C', bg: '#FFF4E8' },
  { label: '本月保养', value: 0, icon: 'SetUp', color: '#67C23A', bg: '#E8FDF4' },
  { label: '本月巡检', value: 0, icon: 'CircleCheck', color: '#9C27B0', bg: '#F4E8FD' }
])

const recentRecords = ref<WorkRecord[]>([])
const upcomingPlans = ref<MaintenancePlan[]>([])
const upcomingCount = ref(0)

const actions = [
  { label: '扫码识别', icon: 'Camera', route: '/equipment/scan', show: true },
  { label: '填报记录', icon: 'Edit', route: '/record/new', show: true },
  { label: '工作记录', icon: 'Document', route: '/record', show: true },
  { label: '常用模板', icon: 'Collection', route: '/template', show: true },
  { label: '设备台账', icon: 'Box', route: '/equipment', show: () => canManageEquipment() },
  { label: '二维码管理', icon: 'QrCode', route: '/equipment-qrcode', show: () => canManageEquipment() },
  { label: '数据导出', icon: 'Download', route: '/export', show: () => canExportData() },
  { label: '用户管理', icon: 'User', route: '/user', show: () => canManageUsers() },
  { label: '日志管理', icon: 'Tickets', route: '/logs', show: () => canViewLogs() },
  { label: '保养计划', icon: 'Calendar', route: '/maintenance', show: () => canViewStatistics() },
  { label: '保养日历', icon: 'Date', route: '/maintenance/calendar', show: () => canViewStatistics() },
  { label: '数据统计', icon: 'DataAnalysis', route: '/statistics', show: () => canViewStatistics() },
]

function isActionVisible(action: any) {
  return typeof action.show === 'function' ? action.show() : action.show
}

function loadAllData() {
  const user = getCurrentUser()
  if (user) {
    userName.value = user.realName || user.username || ''
    userInitial.value = userName.value.charAt(0)
    userRole.value = roleMap[user.role] || '员工'
  }

  recordApi.getRecords({ page: 1, pageSize: 10, ...(canViewAllRecords() ? {} : { createdBy: user?.id }) }).then(res => {
    recentRecords.value = res.data?.list?.slice(0, 5) || []
  }).catch(() => {})

  maintenanceApi.getUpcomingPlans(7).then(res => {
    upcomingPlans.value = res.data || []
    upcomingCount.value = upcomingPlans.value.length
  }).catch(() => {})

  statisticsApi.getDashboardOverview().then(res => {
    if (res.data) {
      stats.value[0].value = res.data.totalEquipments || 0
      stats.value[1].value = res.data.monthlyRepairCount || 0
      stats.value[2].value = res.data.monthlyMaintenanceCount || 0
      stats.value[3].value = res.data.monthlyInspectionCount || 0
    }
  }).catch(() => {})
}

function isUrgent(dateStr: string) {
  return dayjs(dateStr).diff(dayjs(), 'day') <= 3 && dayjs(dateStr).diff(dayjs(), 'day') >= 0
}

onMounted(() => {
  initDarkMode()
  loadFromStorage()
  if (!isLoggedIn()) {
    router.replace('/login')
    return
  }
  loadAllData()
})
</script>

<template>
  <div class="page-container">
    <div class="welcome-card gradient-primary" style="border-radius:16px;padding:24px;color:#fff;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;">{{ userInitial }}</div>
        <div>
          <div style="font-size:20px;font-weight:600;">{{ userName }}</div>
          <div style="font-size:13px;opacity:0.9;">{{ userRole }}</div>
        </div>
      </div>
      <el-button
        :icon="isDark ? Sunny : Moon"
        circle
        size="large"
        style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:20px;"
        @click="toggleDarkMode"
      />
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
      <div v-for="s in stats" :key="s.label" class="stat-card" style="display:flex;align-items:center;gap:16px;">
        <div :style="{width:'52px',height:'52px',borderRadius:'14px',background:s.bg,display:'flex',alignItems:'center',justifyContent:'center'}">
          <el-icon :size="26" :color="s.color"><component :is="iconMap[s.icon]" /></el-icon>
        </div>
        <div>
          <div style="font-size:28px;font-weight:700;color:#1a1a1a;">{{ s.value }}</div>
          <div style="font-size:13px;color:#909399;">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:14px;color:#303133;">快捷操作</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;">
        <div v-for="act in actions.filter(isActionVisible)" :key="act.label"
          @click="router.push(act.route)" class="stat-card"
          style="padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;position:relative;">
          <div style="width:44px;height:44px;border-radius:12px;background:#f5f7fa;display:flex;align-items:center;justify-content:center;">
            <el-icon :size="20" color="#409EFF"><component :is="iconMap[act.icon]" /></el-icon>
          </div>
          <span style="font-size:12px;color:#4a4a4a;font-weight:500;text-align:center;">{{ act.label }}</span>
          <el-badge v-if="act.label === '保养计划' && upcomingCount > 0" :value="upcomingCount" style="position:absolute;top:6px;right:6px;" />
        </div>
      </div>
    </div>

    <div v-if="upcomingPlans.length > 0" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:16px;font-weight:600;margin:0;color:#303133;">即将到期保养</h3>
        <el-button text type="primary" @click="router.push('/maintenance')">查看全部</el-button>
      </div>
      <div class="stat-card" style="padding:0;overflow:hidden;">
        <div v-for="plan in upcomingPlans.slice(0,3)" :key="plan.id"
          @click="router.push(`/maintenance/${plan.id}`)"
          style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.2s;">
          <el-icon :size="22" color="#E6A23C" style="margin-right:12px;"><Tools /></el-icon>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:500;color:#303133;">{{ plan.planName }}</div>
            <div style="font-size:12px;color:#909399;">{{ plan.equipmentName }} · {{ plan.nextMaintenanceDate }}</div>
          </div>
          <el-tag v-if="isUrgent(plan.nextMaintenanceDate)" type="danger" size="small">即将到期</el-tag>
        </div>
      </div>
    </div>

    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:16px;font-weight:600;margin:0;color:#303133;">最近记录</h3>
        <el-button text type="primary" @click="router.push('/record')">查看全部</el-button>
      </div>
      <div class="stat-card" style="padding:0;overflow:hidden;">
        <div v-if="recentRecords.length === 0" style="text-align:center;padding:40px;color:#909399;font-size:14px;">暂无记录</div>
        <div v-for="rec in recentRecords" :key="rec.id"
          @click="router.push(`/record/${rec.id}`)"
          style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.2s;">
          <el-tag :type="rec.type==='repair'?'danger':rec.type==='maintenance'?'primary':rec.type==='inspection'?'success':'warning'" size="small" style="margin-right:12px;">
            {{ recordTypeMap[rec.type] || rec.type }}
          </el-tag>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:500;color:#303133;">{{ rec.title }}</div>
            <div style="font-size:12px;color:#909399;">{{ rec.equipmentName }} · {{ dayjs(rec.createdAt).format('MM月DD日') }}</div>
          </div>
          <el-tag :type="rec.status==='completed'?'success':rec.status==='approved'?'primary':'warning'" size="small">
            {{ recordStatusMap[rec.status] || rec.status }}
          </el-tag>
        </div>
      </div>
    </div>
  </div>
</template>