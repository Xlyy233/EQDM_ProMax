<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { canViewLogs, loadFromStorage, isLoggedIn } from '@/stores/user'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const router = useRouter()
const loading = ref(false)
const levelFilter = ref('')
const data = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filteredList = computed(() => {
  if (!levelFilter.value) return data.value
  return data.value.filter((d: any) => d.level === levelFilter.value)
})

async function loadLogs() {
  loading.value = true
  try {
    const res = await request.get('/logs', { params: { page: page.value, pageSize: pageSize.value } })
    if (res.data.code === 200) {
      data.value = res.data.data?.list || []
      total.value = res.data.data?.total || 0
    }
  } catch (e) {
    ElMessage.error('加载日志失败')
  } finally { loading.value = false }
}

function handlePageChange(p: number) { page.value = p; loadLogs() }

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) { router.replace('/login'); return }
  if (!canViewLogs()) { ElMessage.error('您没有权限访问此页面'); router.replace('/'); return }
  loadLogs()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统日志</h2>
      <div class="header-actions">
        <el-select v-model="levelFilter" placeholder="全部级别" clearable size="small" style="width:120px;" @change="loadLogs">
          <el-option label="INFO" value="info" />
          <el-option label="WARN" value="warn" />
          <el-option label="ERROR" value="error" />
        </el-select>
        <el-button type="primary" size="small" @click="loadLogs" :loading="loading">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div class="stat-card" style="margin:0 24px;" v-loading="loading">
      <div class="log-list">
        <div v-for="(log, i) in filteredList" :key="i" class="log-item" :class="`log-${log.level}`">
          <span class="log-time">{{ log.time }}</span>
          <el-tag
            :type="log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : 'info'"
            size="small"
            effect="dark"
            class="log-level"
          >{{ log.level.toUpperCase() }}</el-tag>
          <span class="log-msg">{{ log.message }}</span>
        </div>
      </div>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无日志" :image-size="80" />

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
}

.log-list {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid #f5f7fa;
  line-height: 1.6;
}

.log-item.log-error {
  background: #fef0f0;
}

.log-item.log-warn {
  background: #fdf6ec;
}

.log-time {
  color: #909399;
  white-space: nowrap;
  min-width: 140px;
  font-size: 12px;
}

.log-level {
  min-width: 52px;
  text-align: center;
  flex-shrink: 0;
}

.log-msg {
  color: #303133;
  word-break: break-all;
}

@media (max-width: 768px) {
  .log-time { min-width: 100px; font-size: 11px; }
  .log-item { padding: 6px 8px; font-size: 12px; }
  .log-msg { font-size: 12px; }
}
</style>