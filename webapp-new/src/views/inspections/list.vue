<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isLoggedIn } from '@/stores/user'
import * as api from '@/api/inspection'

const router = useRouter()
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const startDate = ref('')
const endDate = ref('')

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    const res = await api.getRecords(params)
    list.value = res.data.data?.list || []
    total.value = res.data.data?.total || 0
  } catch { ElMessage.error('加载记录失败') }
  finally { loading.value = false }
}

function handlePageChange(p: number) { page.value = p; loadData() }

function goToForm() { router.push('/inspections/form') }
function goToDetail(id: string) { router.push(`/inspections/detail/${id}`) }

function checkedCount(row: any) {
  return row.items?.filter((it: any) => it.checked).length || 0
}

function totalCount(row: any) {
  return row.items?.length || 0
}

async function handleExport() {
  try {
    const params: any = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    const res = await api.exportRecords(params)
    const data = res.data.data || []
    if (data.length === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }
    const headers = ['巡检日期', '设备编号', '设备名称', '巡检模板', '巡检人', '巡检项目', '备注', '创建时间']
    const csv = headers.join(',') + '\n' + data.map((r: any) => headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `巡检记录_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}

onMounted(() => {
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">巡检记录</h2>
      <div class="header-actions">
        <el-input v-model="keyword" placeholder="搜索设备/模板" size="small" style="width:150px;" clearable @clear="loadData" @change="loadData" />
        <el-date-picker v-model="startDate" type="date" placeholder="开始日期" size="small" style="width:140px;" value-format="YYYY-MM-DD" @change="loadData" />
        <el-date-picker v-model="endDate" type="date" placeholder="结束日期" size="small" style="width:140px;" value-format="YYYY-MM-DD" @change="loadData" />
        <el-button size="small" @click="handleExport">导出</el-button>
        <el-button type="primary" size="small" @click="goToForm">开始巡检</el-button>
      </div>
    </div>

    <div class="stat-card" style="margin:0 24px;" v-loading="loading">
      <el-table :data="list" stripe size="small" v-if="list.length > 0" @row-click="(row: any) => goToDetail(row.id)" style="cursor:pointer;">
        <el-table-column prop="inspectionDate" label="巡检日期" width="110" />
        <el-table-column label="设备" min-width="140">
          <template #default="{ row }">{{ row.equipmentCode }} - {{ row.equipmentName }}</template>
        </el-table-column>
        <el-table-column prop="templateName" label="巡检模板" min-width="130" />
        <el-table-column label="巡检结果" width="90" align="center">
          <template #default="{ row }">
            <span :class="checkedCount(row) === totalCount(row) ? 'text-green-600' : 'text-orange-500'">
              {{ checkedCount(row) }}/{{ totalCount(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="inspector" label="巡检人" width="90" />
        <el-table-column prop="createdAt" label="提交时间" width="140" />
      </el-table>
      <el-empty v-else description="暂无巡检记录" :image-size="80" />

      <div style="display:flex;justify-content:flex-end;margin-top:16px;" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev,pager,next"
          small
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .header-actions { flex-wrap: wrap; }
  .header-actions .el-input,
  .header-actions .el-date-picker { width: 120px !important; }
}
</style>