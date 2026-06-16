<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as recordApi from '@/api/record'
import dayjs from 'dayjs'

const dateRange = ref<[string, string]>([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD')
])
const exporting = ref(false)

async function handleExport() {
  if (!dateRange.value || dateRange.value.length < 2) {
    ElMessage.warning('请选择导出时间范围')
    return
  }
  exporting.value = true
  try {
    const filename = `维修记录_${dateRange.value[0]}_${dateRange.value[1]}.xlsx`
    await recordApi.exportRecordsExcel(dateRange.value[0], dateRange.value[1], filename)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">数据导出</h2>
    </div>

    <div class="stat-card" style="padding:32px;max-width:500px;text-align:center;">
      <el-icon :size="60" color="#409EFF"><Download /></el-icon>
      <h3 style="margin:16px 0 8px;font-size:18px;">导出维修记录</h3>
      <p style="font-size:14px;color:#909399;margin-bottom:20px;">选择时间范围，导出包含图片的 Excel 报表</p>

      <div style="margin-bottom:16px;">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width:100%;"
        />
      </div>

      <el-button type="primary" :loading="exporting" @click="handleExport" style="width:100%;" size="large">
        <el-icon><Download /></el-icon>{{ exporting ? '导出中...' : '导出Excel' }}
      </el-button>
    </div>
  </div>
</template>