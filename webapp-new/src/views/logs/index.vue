<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { canViewLogs, loadFromStorage, isLoggedIn } from '@/stores/user'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const router = useRouter()
const loading = ref(false)
const levelFilter = ref('')
const dateFilter = ref('')
const keyword = ref('')
const dateList = ref<string[]>([])
const data = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

function isRequestLog(log: any) {
  return !!log.method
}

function statusClass(code: number) {
  if (code >= 500) return 'text-red-600 font-bold'
  if (code >= 400) return 'text-orange-500 font-bold'
  if (code >= 300) return 'text-blue-500'
  return 'text-green-600'
}

function methodClass(method: string) {
  const map: Record<string, string> = {
    GET: 'text-blue-600',
    POST: 'text-green-600',
    PUT: 'text-orange-500',
    DELETE: 'text-red-600',
    PATCH: 'text-purple-500'
  }
  return map[method] || 'text-gray-600'
}

async function loadDateList() {
  try {
    const res = await request.get('/logs/files')
    if (res.data.code === 200) {
      dateList.value = res.data.data || []
      if (dateList.value.length > 0 && !dateFilter.value) {
        dateFilter.value = dateList.value[0]
      }
    }
  } catch (e) { /* ignore */ }
}

async function loadLogs() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (levelFilter.value) params.level = levelFilter.value
    if (dateFilter.value) params.date = dateFilter.value
    else params.date = '' // 不传默认最近5天，传空看作全部
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await request.get('/logs', { params })
    if (res.data.code === 200) {
      data.value = res.data.data?.list || []
      total.value = res.data.data?.total || 0
    }
  } catch (e) {
    ElMessage.error('加载日志失败')
  } finally { loading.value = false }
}

function handlePageChange(p: number) { page.value = p; loadLogs() }

let searchTimer: any = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadLogs() }, 400)
}

watch([levelFilter, dateFilter], () => { page.value = 1; loadLogs() })

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) { router.replace('/login'); return }
  if (!canViewLogs()) { ElMessage.error('您没有权限访问此页面'); router.replace('/'); return }
  loadDateList().then(() => loadLogs())
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统日志</h2>
      <div class="header-actions">
        <el-input
          v-model="keyword"
          placeholder="搜索路径 / IP"
          size="small"
          clearable
          style="width:180px;"
          @input="onSearchInput"
          @clear="loadLogs"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="dateFilter" placeholder="选择日期" size="small" style="width:140px;" clearable @clear="loadLogs">
          <el-option v-for="d in dateList" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="levelFilter" placeholder="全部级别" size="small" style="width:100px;" clearable>
          <el-option label="INFO" value="info" />
          <el-option label="WARN" value="warn" />
          <el-option label="ERROR" value="error" />
        </el-select>
        <el-button size="small" @click="loadLogs" :loading="loading">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div class="stat-card" style="margin:0 24px;" v-loading="loading">
      <!-- 请求日志表格 -->
      <el-table v-if="data.length > 0" :data="data" stripe size="small" style="width:100%;" :row-class-name="({row}: any) => row.level === 'error' ? 'row-error' : row.level === 'warn' ? 'row-warn' : ''">
        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            <span v-if="isRequestLog(row)" class="log-time">{{ row.time }}</span>
            <span v-else class="log-time" style="color:#303133;">{{ row.time }}</span>
          </template>
        </el-table-column>
        <el-table-column label="级别" width="70">
          <template #default="{ row }">
            <el-tag
              :type="row.level === 'error' ? 'danger' : row.level === 'warn' ? 'warning' : 'info'"
              size="small"
              effect="dark"
            >{{ row.level.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <!-- 请求日志：结构化列 -->
        <template v-if="isRequestLog(data[0])">
          <el-table-column label="方法" width="72">
            <template #default="{ row }">
              <span v-if="isRequestLog(row)" :class="methodClass(row.method)" class="font-semibold">{{ row.method }}</span>
            </template>
          </el-table-column>
          <el-table-column label="路径" min-width="200">
            <template #default="{ row }">
              <span v-if="isRequestLog(row)" class="text-sm font-mono">{{ row.path }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态码" width="72" align="center">
            <template #default="{ row }">
              <span v-if="isRequestLog(row)" :class="statusClass(row.statusCode)" class="font-semibold">{{ row.statusCode }}</span>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="72" align="right">
            <template #default="{ row }">
              <span v-if="isRequestLog(row)" class="text-sm" :class="row.duration > 1000 ? 'text-red-500 font-semibold' : 'text-gray-500'">{{ row.duration }}ms</span>
            </template>
          </el-table-column>
          <el-table-column label="IP" width="140">
            <template #default="{ row }">
              <span v-if="isRequestLog(row)" class="text-sm text-gray-500 font-mono">{{ row.ip }}</span>
            </template>
          </el-table-column>
        </template>
        <!-- 非请求日志：消息列 -->
        <template v-else>
          <el-table-column label="内容" min-width="300">
            <template #default="{ row }">
              <span class="text-sm">{{ row.message }}</span>
            </template>
          </el-table-column>
        </template>
      </el-table>

      <el-empty v-if="!loading && data.length === 0" description="暂无日志" :image-size="80" />

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

.log-time {
  color: #909399;
  font-size: 12px;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

:deep(.row-error) { background-color: #fef0f0 !important; }
:deep(.row-warn) { background-color: #fdf6ec !important; }

@media (max-width: 768px) {
  .header-actions {
    flex-wrap: wrap;
    gap: 6px;
  }
  .header-actions .el-input,
  .header-actions .el-select {
    width: 130px !important;
  }
}
</style>