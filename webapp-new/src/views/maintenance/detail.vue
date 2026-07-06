<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { cycleTypeMap, maintenanceStatusMap } from '@/types'
import type { MaintenancePlan } from '@/types'
import * as maintenanceApi from '@/api/maintenance'

const route = useRoute()
const router = useRouter()
const plan = ref<MaintenancePlan | null>(null)
const loading = ref(true)

function loadData() {
  loading.value = true
  maintenanceApi.getPlanById(route.params.id as string).then(res => {
    plan.value = res.data
  }).catch(() => {}).finally(() => { loading.value = false })
}

function handleDelete() {
  ElMessageBox.confirm('确定删除该计划？', '确认', { type: 'warning' }).then(() => {
    maintenanceApi.deletePlan(route.params.id as string).then(() => {
      ElMessage.success('删除成功')
      router.replace('/maintenance')
    }).catch(() => {})
  }).catch(() => {})
}

function handleComplete() {
  ElMessageBox.confirm('确定标记为已完成？', '确认', { type: 'info' }).then(() => {
    maintenanceApi.completePlan(route.params.id as string).then(() => {
      ElMessage.success('已标记完成')
      loadData()
    }).catch(() => {})
  }).catch(() => {})
}

function handlePause() {
  ElMessageBox.confirm('确定暂停该计划？', '确认', { type: 'warning' }).then(() => {
    maintenanceApi.updatePlan(route.params.id as string, { status: 'paused' }).then(() => {
      ElMessage.success('已暂停')
      loadData()
    }).catch(() => {})
  }).catch(() => {})
}

function handleResume() {
  maintenanceApi.updatePlan(route.params.id as string, { status: 'active' }).then(() => {
    ElMessage.success('已恢复')
    loadData()
  }).catch(() => {})
}

function goToRecord() {
  if (!plan.value) return
  router.push('/record/new?equipmentId=' + encodeURIComponent(plan.value.equipmentId) + '&equipmentName=' + encodeURIComponent(plan.value.equipmentName))
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">计划详情</h2>
      </div>
      <div style="display:flex;gap:8px;" v-if="plan">
        <el-button type="primary" @click="goToRecord">
          <el-icon><Edit /></el-icon> 填写保养记录
        </el-button>
        <el-button v-if="plan.status==='active'" type="success" @click="handleComplete">
          <el-icon><Check /></el-icon> 完成保养
        </el-button>
        <el-button v-if="plan.status==='active'" type="warning" @click="handlePause">
          <el-icon><VideoPause /></el-icon> 暂停
        </el-button>
        <el-button v-if="plan.status==='paused'" type="success" @click="handleResume">
          <el-icon><VideoPlay /></el-icon> 恢复
        </el-button>
        <el-button type="primary" @click="router.push(`/maintenance/${route.params.id}/edit`)">
          <el-icon><Edit /></el-icon> 编辑
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon> 删除
        </el-button>
      </div>
    </div>

    <div v-loading="loading" v-if="plan" class="detail-wrapper">
      <div class="section-card">
        <div class="section-title">基本信息</div>
        <el-descriptions :column="2" border size="default">
          <el-descriptions-item label="计划名称" :content-style="{ fontWeight: 500 }">{{ plan.planName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="plan.status==='active'?'success':plan.status==='paused'?'warning':'info'">
              {{ maintenanceStatusMap[plan.status] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="设备名称">{{ plan.equipmentName }}</el-descriptions-item>
          <el-descriptions-item label="设备编号">{{ plan.equipmentCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ plan.responsibleUserName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ plan.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="section-card">
        <div class="section-title">周期信息</div>
        <el-descriptions :column="2" border size="default">
          <el-descriptions-item label="周期类型">{{ cycleTypeMap[plan.cycleType] || '-' }}</el-descriptions-item>
          <el-descriptions-item label="周期值">{{ plan.cycleValue }}</el-descriptions-item>
          <el-descriptions-item label="上次保养">{{ plan.lastMaintenanceDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="下次保养">
            <span :style="{ color: isUrgent(plan.nextMaintenanceDate) ? '#F56C6C' : '#303133', fontWeight: isUrgent(plan.nextMaintenanceDate) ? 600 : 400 }">
              {{ plan.nextMaintenanceDate || '-' }}
            </span>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="section-card" v-if="plan.remark">
        <div class="section-title">备注</div>
        <div class="remark-text">{{ plan.remark }}</div>
      </div>
    </div>

    <div v-if="!loading && !plan" style="text-align:center;padding:60px;color:#909399;">
      <el-icon :size="48" color="#c0c4cc"><Warning /></el-icon>
      <p>计划不存在或已被删除</p>
    </div>
  </div>
</template>

<script lang="ts">
function isUrgent(dateStr: string): boolean {
  if (!dateStr) return false
  const next = new Date(dateStr)
  if (isNaN(next.getTime())) return false
  const now = new Date()
  const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 3 && diff >= 0
}
</script>

<style scoped>
.detail-wrapper {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}

.section-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 20px 4px;
  margin-bottom: 16px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background: #409EFF;
  border-radius: 2px;
}

.remark-text {
  color: #606266;
  line-height: 1.7;
  padding: 8px 0 12px;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .detail-wrapper {
    padding: 12px 12px 32px;
  }

  .section-card {
    padding: 16px 14px 2px;
    margin-bottom: 12px;
    border-radius: 8px;
  }
}
</style>