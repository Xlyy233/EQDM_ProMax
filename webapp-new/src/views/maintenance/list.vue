<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { cycleTypeMap, maintenanceStatusMap } from '@/types'
import type { MaintenancePlan } from '@/types'
import * as maintenanceApi from '@/api/maintenance'
import { canManageMaintenance, loadFromStorage, isLoggedIn } from '@/stores/user'

const router = useRouter()
const keyword = ref('')
const activeStatus = ref('')
const list = ref<MaintenancePlan[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const hasPermission = canManageMaintenance()

const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'active' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' }
]

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) {
    router.replace('/login')
    return
  }
  if (!hasPermission) {
    ElMessage.error('您没有权限访问此页面')
    router.replace('/')
    return
  }
  loadData()
})

function loadData() {
  loading.value = true
  const params: any = { page: page.value, pageSize: pageSize.value }
  if (keyword.value) params.keyword = keyword.value
  if (activeStatus.value) params.status = activeStatus.value
  maintenanceApi.getPlans(params).then(res => {
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  }).catch(() => {}).finally(() => { loading.value = false })
}

function onSearch() { page.value = 1; loadData() }
function onStatusChange(status: string) { activeStatus.value = status; page.value = 1; loadData() }
function handlePageChange(p: number) { page.value = p; loadData() }

function handleDelete(plan: MaintenancePlan) {
  ElMessageBox.confirm(`确定删除计划「${plan.planName}」？`, '确认', { type: 'warning' }).then(() => {
    maintenanceApi.deletePlan(plan.id).then(() => { ElMessage.success('删除成功'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function handleComplete(plan: MaintenancePlan) {
  ElMessageBox.confirm(`确认完成「${plan.planName}」的保养？`, '确认', { type: 'info' }).then(() => {
    maintenanceApi.completePlan(plan.id).then(() => { ElMessage.success('已标记完成'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function isUrgent(dateStr: string): boolean {
  if (!dateStr) return false
  const next = new Date(dateStr)
  if (isNaN(next.getTime())) return false
  const now = new Date()
  const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 3 && diff >= 0
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-icon :size="22"><Calendar /></el-icon>
        <h2 class="page-title">保养计划</h2>
      </div>
      <div style="display:flex;gap:8px;">
        <el-button @click="router.push('/maintenance/calendar')">
          <el-icon><Date /></el-icon> 保养日历
        </el-button>
        <el-button type="primary" @click="router.push('/maintenance/new')">
          <el-icon><Plus /></el-icon> 新增计划
        </el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索计划名称或设备"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
        class="search-input"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button @click="onSearch">
        <el-icon><Search /></el-icon> 搜索
      </el-button>
    </div>

    <!-- 状态筛选 -->
    <div class="status-tabs">
      <span
        v-for="tab in statusTabs"
        :key="tab.value"
        class="status-tab"
        :class="{ active: activeStatus === tab.value }"
        @click="onStatusChange(tab.value)"
      >{{ tab.label }}</span>
    </div>

    <!-- 计划卡片列表 -->
    <div v-loading="loading" class="plan-list">
      <div
        class="plan-card"
        v-for="plan in list"
        :key="plan.id"
        @click="router.push(`/maintenance/${plan.id}`)"
      >
        <div class="card-top">
          <div class="card-title-row">
            <span class="card-title">{{ plan.planName }}</span>
            <el-tag
              :type="plan.status==='active'?'success':plan.status==='paused'?'warning':'info'"
              size="small"
            >{{ maintenanceStatusMap[plan.status] }}</el-tag>
          </div>
          <span class="card-equipment">{{ plan.equipmentName }} ({{ plan.equipmentCode }})</span>
        </div>

        <div class="card-body">
          <div class="card-info-item">
            <span class="info-label">周期</span>
            <span class="info-value">{{ cycleTypeMap[plan.cycleType] }}</span>
          </div>
          <div class="card-info-item">
            <span class="info-label">下次保养</span>
            <span class="info-value" :class="{ urgent: isUrgent(plan.nextMaintenanceDate) }">
              {{ plan.nextMaintenanceDate || '-' }}
            </span>
          </div>
          <div class="card-info-item">
            <span class="info-label">负责人</span>
            <span class="info-value">{{ plan.responsibleUserName || '-' }}</span>
          </div>
        </div>

        <div class="card-footer">
          <span class="last-date">上次保养: {{ plan.lastMaintenanceDate || '无' }}</span>
          <div class="card-actions" @click.stop>
            <el-button
              v-if="plan.status==='active'"
              type="success"
              size="small"
              @click="handleComplete(plan)"
            >
              <el-icon><Check /></el-icon> 完成
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(plan)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="64" color="#c0c4cc"><Calendar /></el-icon>
        <p>暂无保养计划</p>
        <el-button type="primary" @click="router.push('/maintenance/new')">新增计划</el-button>
      </div>
    </div>

    <!-- 分页 -->
    <div style="margin-top:16px;display:flex;justify-content:center;" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
/* ====== 工具栏 ====== */
.toolbar {
  display: flex;
  gap: 12px;
  padding: 0 20px 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-input {
  max-width: 320px;
}

/* ====== 状态筛选 ====== */
.status-tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.status-tab {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: #606266;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.status-tab:hover {
  color: #409EFF;
}

.status-tab.active {
  background: #409EFF;
  color: #fff;
}

/* ====== 卡片列表 ====== */
.plan-list {
  padding: 0 20px 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.plan-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 14px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-top {
  margin-bottom: 14px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.card-equipment {
  font-size: 13px;
  color: #909399;
}

.card-body {
  display: flex;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.card-info-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 12px;
  color: #909399;
}

.info-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.info-value.urgent {
  color: #F56C6C;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-date {
  font-size: 12px;
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
}

/* ====== 空状态 ====== */
.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.empty-state p {
  margin: 12px 0 16px;
  font-size: 14px;
}

/* ====== 移动端 ====== */
@media (max-width: 768px) {
  .toolbar {
    padding: 0 12px 12px;
    flex-direction: column;
  }

  .search-input {
    max-width: none;
  }

  .status-tabs {
    padding: 0 12px 12px;
  }

  .plan-list {
    padding: 0 12px 12px;
  }

  .plan-card {
    padding: 16px;
    margin-bottom: 10px;
  }

  .card-body {
    gap: 10px;
  }
}
</style>