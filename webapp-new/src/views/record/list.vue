<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getCurrentUser, canViewAllRecords, canManageUsers, loadFromStorage, isLoggedIn } from '@/stores/user'
import { recordTypeMap } from '@/types'
import type { WorkRecord } from '@/types'
import * as recordApi from '@/api/record'
import dayjs from 'dayjs'

const router = useRouter()
const keyword = ref('')
const filterType = ref('')
const list = ref<WorkRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

function loadData() {
  loading.value = true
  const params: any = { page: page.value, pageSize: pageSize.value }
  if (keyword.value.trim()) params.keyword = keyword.value.trim()
  if (filterType.value) params.type = filterType.value
  if (!canViewAllRecords()) {
    params.createdBy = getCurrentUser()?.id
  }
  recordApi.getRecords(params).then(res => {
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  }).catch(() => {}).finally(() => { loading.value = false })
}

function handleSearch() { page.value = 1; loadData() }
function handlePageChange(p: number) { page.value = p; loadData() }
function handleSizeChange(s: number) { pageSize.value = s; page.value = 1; loadData() }

function handleDelete(id: string) {
  ElMessageBox.confirm('确定删除该记录？', '确认', { type: 'warning' }).then(() => {
    recordApi.deleteRecord(id).then(() => { ElMessage.success('删除成功'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function canEdit(record: WorkRecord) {
  const uid = getCurrentUser()?.id
  return uid && (record.createdBy === uid || canManageUsers())
}

function formatDate(str: string) {
  if (!str) return '-'
  return dayjs(str).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">工作记录</h2>
      <el-button type="primary" @click="router.push('/record/new')"><el-icon><Plus /></el-icon>新增记录</el-button>
    </div>

    <div class="stat-card search-card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <el-select v-model="filterType" placeholder="全部类型" clearable style="width:140px;" @change="handleSearch">
          <el-option label="维修" value="repair" />
          <el-option label="保养" value="maintenance" />
          <el-option label="巡检" value="inspection" />
          <el-option label="改善" value="improvement" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索标题/设备/内容" clearable style="max-width:300px;flex:1;min-width:200px;" @clear="handleSearch" @keyup.enter="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
      </div>
    </div>

    <div class="stat-card" v-loading="loading">
      <div class="table-responsive">
      <el-table :data="list" border stripe empty-text="暂无工作记录" class="record-table" @row-click="(row:any) => router.push(`/record/${row.id}`)">
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.type==='repair'?'danger':row.type==='maintenance'?'primary':row.type==='inspection'?'success':'warning'" size="small">{{ recordTypeMap[row.type] || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="personnel" label="维修人员" width="110" />
        <el-table-column prop="equipmentName" label="关联设备" min-width="140" show-overflow-tooltip />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="填报时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt || row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" class-name="op-col" @click.stop>
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="router.push(`/record/${row.id}`)">详情</el-button>
            <el-button v-if="canEdit(row)" link type="primary" size="small" @click.stop="router.push(`/record/${row.id}/edit`)">编辑</el-button>
            <el-button v-if="canEdit(row)" link type="danger" size="small" @click.stop="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-card {
  margin-bottom: 16px;
}

.record-table :deep(.el-table__row) {
  cursor: pointer;
}

@media (max-width: 768px) {
  .search-card {
    padding: 12px !important;
    margin: 12px !important;
  }

  .record-table :deep(.el-table__cell) {
    padding: 8px 6px;
  }

  .record-table :deep(.op-col) {
    display: none;
  }
}
</style>
