<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentUser, canManageUsers } from '@/stores/user'
import { recordTypeMap } from '@/types'
import { getProcessResultOptions } from '@/data/recordTemplates'
import type { WorkRecord } from '@/types'
import * as recordApi from '@/api/record'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const record = ref<WorkRecord | null>(null)
const loading = ref(true)

const isEdit = computed(() => {
  const uid = getCurrentUser()?.id
  return uid && record.value && (record.value.createdBy === uid || canManageUsers())
})

function loadData() {
  loading.value = true
  recordApi.getRecordById(route.params.id as string).then(res => {
    record.value = res.data
  }).catch(() => {}).finally(() => { loading.value = false })
}

function handleDelete() {
  ElMessageBox.confirm('确定删除该记录？', '确认', { type: 'warning' }).then(() => {
    recordApi.deleteRecord(route.params.id as string).then(() => {
      ElMessage.success('删除成功')
      router.replace('/record')
    }).catch(() => {})
  }).catch(() => {})
}

function formatDate(str: string) {
  if (!str) return '-'
  return dayjs(str).format('YYYY-MM-DD HH:mm')
}

// ========== 处理结果名称 ==========
const processResultOptions = getProcessResultOptions()
function getResultLabel(result: string) {
  return processResultOptions.find(o => o.value === result)?.label || result || '-'
}

// ========== 照片预览 ==========
const showPhoto = ref(false)
const currentPhotoUrl = ref('')

function previewPhoto(url: string) {
  currentPhotoUrl.value = url
  showPhoto.value = true
}

const pageTitle = computed(() => {
  if (!record.value || !record.value.equipmentCode) return '记录详情'
  return record.value.equipmentCode + ' - ' + record.value.equipmentName + ' - 记录详情'
})

const equipmentDisplay = computed(() => {
  if (!record.value) return '-'
  const code = record.value.equipmentCode || ''
  const name = record.value.equipmentName || ''
  if (code && name) return code + ' - ' + name
  return name || '-'
})

function onKeydown(e: KeyboardEvent) {
  if (!showPhoto.value) return
  if (e.key === 'Escape') showPhoto.value = false
}

onMounted(() => {
  loadData()
  document.addEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()" aria-label="返回"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">{{ pageTitle }}</h2>
      </div>
      <div style="display:flex;gap:8px;" v-if="isEdit">
        <el-button type="primary" @click="router.push(`/record/${route.params.id}/edit`)">编辑</el-button>
        <el-button type="danger" @click="handleDelete">删除</el-button>
      </div>
    </div>

    <div v-loading="loading" v-if="record" class="detail-wrapper">
      <!-- ====== 基本信息卡片 ====== -->
      <div class="section-card">
        <div class="section-title">基本信息</div>
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="标题" :content-style="{ color: '#303133', fontWeight: 500, fontSize: '15px' }">{{ record.title }}</el-descriptions-item>
          <el-descriptions-item label="记录类型">
            <el-tag :type="record.type==='repair'?'danger':record.type==='maintenance'?'primary':record.type==='inspection'?'success':'warning'" size="default">
              {{ recordTypeMap[record.type] || record.type }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="关联设备">{{ equipmentDisplay }}</el-descriptions-item>
          <el-descriptions-item label="维修人员">{{ record.personnel || '-' }}</el-descriptions-item>
          <el-descriptions-item label="填报时间">{{ formatDate(record.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(record.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- ====== 时间信息卡片 ====== -->
      <div class="section-card">
        <div class="section-title">时间信息</div>
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="开始时间">{{ formatDate(record.startTime) }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ formatDate(record.endTime) }}</el-descriptions-item>
          <el-descriptions-item label="是否停机">{{ record.isStopped === 'yes' ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item v-if="record.isStopped === 'yes'" label="停机时长">
            {{ (record.stopDuration || '0') + (record.stopDurationUnit === 'hours' ? '小时' : '分钟') }}
          </el-descriptions-item>
          <el-descriptions-item label="是否更换配件">{{ record.partsReplaced === 'yes' ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item v-if="record.partsReplaced === 'yes' && record.consumedParts && record.consumedParts.length > 0" label="消耗配件">
            <div class="parts-list">
              <span v-for="(p, i) in record.consumedParts" :key="i" class="parts-tag">{{ p.sparePartName }} ×{{ p.quantity }}</span>
            </div>
          </el-descriptions-item>
          <el-descriptions-item v-if="record.partsReplaced === 'yes' && record.partsReplacedDetail" label="更换详情补充">
            <div class="content-text">{{ record.partsReplacedDetail }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- ====== 作业内容卡片 ====== -->
      <div class="section-card">
        <div class="section-title">作业内容</div>
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="故障描述">
            <div class="content-text">{{ record.faultDescription || record.content || '-' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="故障原因">
            <div class="content-text">{{ record.faultCause || '-' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="解决办法">
            <div class="content-text">{{ record.solution || '-' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="处理结果">
            <el-tag :type="record.result === 'fixed' ? 'success' : record.result === 'observing' ? 'warning' : record.result === 'needs_parts' ? 'primary' : record.result === 'unrepairable' ? 'danger' : 'info'" size="default">
              {{ getResultLabel(record.result) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="record.remark" label="备注">
            <div class="content-text">{{ record.remark }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- ====== 处理前现场照片 ====== -->
      <div class="section-card" v-if="record.photos && record.photos.length > 0">
        <div class="section-title">操作处理前现场照片 ({{ record.photos.length }}张)</div>
        <div class="photos-grid">
          <div
            class="photo-item"
            v-for="(photo, index) in record.photos"
            :key="'before-'+index"
            @click="previewPhoto(photo)"
          >
            <img :src="photo" class="photo-img" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- ====== 处理后现场照片 ====== -->
      <div class="section-card" v-if="record.afterPhotos && record.afterPhotos.length > 0">
        <div class="section-title">操作处理后现场照片 ({{ record.afterPhotos.length }}张)</div>
        <div class="photos-grid">
          <div
            class="photo-item"
            v-for="(photo, index) in record.afterPhotos"
            :key="'after-'+index"
            @click="previewPhoto(photo)"
          >
            <img :src="photo" class="photo-img" loading="lazy" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && !record" style="text-align:center;padding:60px;color:#909399;">
      <el-icon :size="48" color="#c0c4cc"><Warning /></el-icon>
      <p>记录不存在或已被删除</p>
    </div>

    <!-- ====== 全屏预览弹窗 ====== -->
    <teleport to="body">
      <div class="photo-modal" v-if="showPhoto" @click="showPhoto = false">
        <div class="modal-close" @click="showPhoto = false">
          <el-icon :size="28" color="#fff"><Close /></el-icon>
        </div>
        <img
          :src="currentPhotoUrl"
          class="modal-photo"
          @click.stop
        />
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.detail-wrapper {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}

/* ====== 卡片分区 ====== */
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

/* ====== 内容文字 ====== */
.content-text {
  white-space: pre-wrap;
  line-height: 1.7;
  color: #606266;
}

.parts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.parts-tag {
  display: inline-block;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 13px;
}

/* ====== 照片展示 ====== */
.photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.photo-item {
  width: 110px;
  height: 110px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #ebeef5;
  transition: transform 0.2s;
}

.photo-item:hover {
  transform: scale(1.03);
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ====== 全屏预览弹窗 ====== */
.photo-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  overscroll-behavior: contain;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  cursor: pointer;
  z-index: 1;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-photo {
  max-width: 90vw;
  max-height: 75vh;
  object-fit: contain;
  border-radius: 4px;
}

.photo-nav {
  position: absolute;
  bottom: 40px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.nav-text {
  color: #fff;
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}

/* ====== 移动端优化 ====== */
@media (max-width: 768px) {
  .detail-wrapper {
    padding: 12px 12px 32px;
  }

  .section-card {
    padding: 16px 14px 2px;
    margin-bottom: 12px;
    border-radius: 8px;
  }

  .section-title {
    font-size: 14px;
    margin-bottom: 12px;
  }

  .photo-item {
    width: 90px;
    height: 90px;
  }

  .modal-close {
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
  }

  .photo-nav {
    bottom: 30px;
    gap: 16px;
  }

  .nav-btn {
    padding: 6px 16px;
    font-size: 13px;
  }
}
</style>