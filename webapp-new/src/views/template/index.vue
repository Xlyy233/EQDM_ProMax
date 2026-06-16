<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const templates = ref([
  { id: '1', name: '日常巡检模板', desc: '包含设备巡检标准流程', type: 'inspection' },
  { id: '2', name: '定期保养模板', desc: '设备保养标准作业流程', type: 'maintenance' },
  { id: '3', name: '故障维修模板', desc: '设备故障报修标准流程', type: 'repair' },
])

function useTemplate(type: string) {
  router.push(`/record/new?type=${type}`)
  ElMessage.success('已选择模板，请填写具体信息')
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">常用模板</h2>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
      <div v-for="tpl in templates" :key="tpl.id" class="stat-card" style="padding:20px;cursor:pointer;" @click="useTemplate(tpl.type)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:#E8F4FD;display:flex;align-items:center;justify-content:center;">
            <el-icon :size="20" color="#409EFF"><Collection /></el-icon>
          </div>
          <span style="font-size:16px;font-weight:600;">{{ tpl.name }}</span>
        </div>
        <p style="font-size:14px;color:#909399;margin:0;">{{ tpl.desc }}</p>
        <el-button type="primary" size="small" style="margin-top:12px;">使用模板</el-button>
      </div>
    </div>
  </div>
</template>