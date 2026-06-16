<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { MaintenancePlan } from '@/types'
import * as maintenanceApi from '@/api/maintenance'
import dayjs from 'dayjs'

const router = useRouter()
const plans = ref<MaintenancePlan[]>([])
const loading = ref(true)
const currentMonth = ref(dayjs())

const daysInMonth = computed(() => {
  const start = currentMonth.value.startOf('month')
  const end = currentMonth.value.endOf('month')
  const days: dayjs.Dayjs[] = []
  const startDay = start.day()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(start.subtract(i + 1, 'day'))
  }
  for (let i = 0; i < end.date(); i++) {
    days.push(start.add(i, 'day'))
  }
  return days
})

function getPlansForDay(date: dayjs.Dayjs) {
  return plans.value.filter(p => dayjs(p.nextMaintenanceDate).isSame(date, 'day'))
}

function isToday(date: dayjs.Dayjs) { return date.isSame(dayjs(), 'day') }
function isCurrentMonth(date: dayjs.Dayjs) { return date.month() === currentMonth.value.month() }

function prevMonth() { currentMonth.value = currentMonth.value.subtract(1, 'month'); loadPlans() }
function nextMonth() { currentMonth.value = currentMonth.value.add(1, 'month'); loadPlans() }

function loadPlans() {
  loading.value = true
  maintenanceApi.getPlans({ pageSize: 999 }).then(res => {
    plans.value = (res.data?.list || []).filter(p => p.status === 'active')
  }).catch(() => {}).finally(() => { loading.value = false })
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

onMounted(loadPlans)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">保养日历</h2>
      </div>
      <el-button @click="router.push('/maintenance')">列表视图</el-button>
    </div>

    <div class="stat-card" style="padding:16px;" v-loading="loading">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <el-button text @click="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
        <span style="font-size:18px;font-weight:600;">{{ currentMonth.format('YYYY年MM月') }}</span>
        <el-button text @click="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:13px;color:#909399;margin-bottom:8px;">
        <div v-for="d in weekDays" :key="d">{{ d }}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
        <div v-for="(day, idx) in daysInMonth" :key="idx"
          :style="{
            padding:'8px 4px',minHeight:'70px',textAlign:'center',borderRadius:'8px',
            background: isToday(day) ? '#E8F4FD' : 'transparent',
            opacity: isCurrentMonth(day) ? 1 : 0.35,
            border: getPlansForDay(day).length > 0 ? '2px solid #409EFF' : '1px solid #f0f0f0'
          }">
          <div style="font-size:14px;font-weight:500;margin-bottom:4px;">{{ day.date() }}</div>
          <div v-for="p in getPlansForDay(day)" :key="p.id"
            @click="router.push(`/maintenance/${p.id}`)"
            style="background:#409EFF;color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;margin-bottom:2px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {{ p.planName }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>