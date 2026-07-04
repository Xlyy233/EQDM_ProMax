<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isLoggedIn } from '@/stores/user'
import * as api from '@/api/inspection'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const record = ref<any>(null)

const showPhoto = ref(false)
const currentPhotoUrl = ref('')

const pageTitle = computed(() => {
  if (!record.value) return '巡检详情'
  return record.value.equipmentCode + ' - ' + record.value.equipmentName + ' - 巡检详情'
})

const beforePhotos = computed(() => {
  if (!record.value) return []
  const p = record.value.photos
  if (typeof p === 'string') { try { return JSON.parse(p) } catch { return [] } }
  return Array.isArray(p) ? p : []
})

const afterPhotosList = computed(() => {
  if (!record.value) return []
  const p = record.value.afterPhotos
  if (typeof p === 'string') { try { return JSON.parse(p) } catch { return [] } }
  return Array.isArray(p) ? p : []
})

async function loadData() {
  loading.value = true
  try {
    const res = await api.getRecord(route.params.id as string)
    record.value = res.data.data
    document.title = pageTitle.value + ' - 设备管理系统'
  } catch { ElMessage.error('加载记录失败'); router.push('/inspections/list') }
  finally { loading.value = false }
}

function previewPhoto(url: string) {
  currentPhotoUrl.value = url
  showPhoto.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showPhoto.value = false
}

onMounted(() => {
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadData()
  document.addEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">{{ pageTitle }}</h2>
      <el-button size="small" @click="router.back()">返回</el-button>
    </div>

    <div class="form-card" v-loading="loading" v-if="record">
      <!-- 基本信息 -->
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">巡检日期</span>
          <span class="info-value">{{ record.inspectionDate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">设备信息</span>
          <span class="info-value">{{ record.equipmentCode }} - {{ record.equipmentName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">巡检模板</span>
          <span class="info-value">{{ record.templateName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">巡检人</span>
          <span class="info-value">{{ record.inspector }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">提交时间</span>
          <span class="info-value">{{ record.createdAt }}</span>
        </div>
      </div>

      <!-- 巡检结果 -->
      <div class="section-card" v-if="record.items && record.items.length > 0">
        <div class="section-title">巡检结果</div>
        <div class="checklist">
          <div v-for="(item, index) in record.items" :key="item.id" class="checklist-row">
            <span class="check-num">{{ index + 1 }}.</span>
            <span class="check-content">{{ item.content }}</span>
            <el-tag :type="item.checked ? 'success' : 'danger'" size="small" effect="dark">
              {{ item.checked ? '通过' : '不通过' }}
            </el-tag>
            <span v-if="!item.checked && item.remark" class="check-remark">{{ item.remark }}</span>
          </div>
        </div>
      </div>

      <!-- 处理前照片 -->
      <div class="section-card" v-if="beforePhotos.length > 0">
        <div class="section-title">操作处理前现场照片 ({{ beforePhotos.length }}张)</div>
        <div class="photos-grid">
          <div class="photo-item" v-for="(p, i) in beforePhotos" :key="'before-'+i" @click="previewPhoto(p)">
            <img :src="p" class="photo-img" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- 处理后照片 -->
      <div class="section-card" v-if="afterPhotosList.length > 0">
        <div class="section-title">操作处理后现场照片 ({{ afterPhotosList.length }}张)</div>
        <div class="photos-grid">
          <div class="photo-item" v-for="(p, i) in afterPhotosList" :key="'after-'+i" @click="previewPhoto(p)">
            <img :src="p" class="photo-img" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- 备注 -->
      <div class="section-card" v-if="record.remark">
        <div class="section-title">备注</div>
        <div class="remark-text">{{ record.remark }}</div>
      </div>

      <div v-if="!record.items || record.items.length === 0" style="text-align:center;color:#909399;padding:20px;">
        暂无巡检数据
      </div>
    </div>

    <!-- 预览弹窗 -->
    <teleport to="body">
      <div class="photo-modal" v-if="showPhoto" @click="showPhoto = false">
        <div class="modal-close" @click="showPhoto = false">
          <el-icon :size="28" color="#fff"><Close /></el-icon>
        </div>
        <img :src="currentPhotoUrl" class="modal-photo" @click.stop />
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.form-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label { font-size: 12px; color: #909399; }
.info-value { font-size: 14px; color: #303133; font-weight: 500; }

.section-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.checklist-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
}
.checklist-row:last-child { border-bottom: none; }
.check-num { color: #909399; font-size: 13px; flex-shrink: 0; }
.check-content { flex: 1; font-size: 14px; min-width: 120px; }
.check-remark { font-size: 12px; color: #f56c6c; font-style: italic; width: 100%; margin-top: 2px; }

.photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-item {
  width: 90px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  cursor: pointer;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remark-text { font-size: 14px; color: #606266; line-height: 1.6; }

.photo-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  cursor: pointer;
  z-index: 1;
}
.modal-photo {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
}

@media (max-width: 768px) {
  .form-card { margin: 0 12px; padding: 14px; }
  .info-grid { grid-template-columns: 1fr; }
  .photo-item { width: 80px; height: 80px; }
}
</style>