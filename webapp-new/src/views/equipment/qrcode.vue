<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { canManageEquipment, loadFromStorage, isLoggedIn } from '@/stores/user'
import type { Equipment } from '@/types'
import * as equipmentApi from '@/api/equipment'
import QRCode from 'qrcode'

const router = useRouter()
const list = ref<Equipment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const keyword = ref('')
const qrCodeImages = ref<Record<string, string>>({})

const hasPermission = canManageEquipment()

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

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    const res = await equipmentApi.getEquipments(params)
    list.value = res.data?.list || []
    total.value = res.data?.total || 0

    // 批量生成二维码
    for (const eq of list.value) {
      if (!qrCodeImages.value[eq.id]) {
        try {
          const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin
          const qrContent = `${baseUrl}/record/new?equipmentId=${encodeURIComponent(eq.id)}&equipmentName=${encodeURIComponent(eq.name)}`
          qrCodeImages.value[eq.id] = await QRCode.toDataURL(qrContent, { width: 200, margin: 2 })
        } catch {}
      }
    }
  } catch {} finally { loading.value = false }
}

function onSearch() {
  page.value = 1
  qrCodeImages.value = {}
  loadData()
}

function handleDownloadOne(eq: Equipment) {
  const url = qrCodeImages.value[eq.id]
  if (!url) return
  const link = document.createElement('a')
  link.href = url
  link.download = `设备二维码_${eq.code}_${eq.name}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success('下载成功')
}

function handlePageChange(p: number) { page.value = p; loadData() }
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-icon :size="22"><PictureFilled /></el-icon>
        <h2 class="page-title">二维码管理</h2>
      </div>
      
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索设备编号或名称"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="onSearch">
        <el-icon><Search /></el-icon> 搜索
      </el-button>
    </div>

    <!-- 二维码卡片网格 -->
    <div v-loading="loading" class="qrcode-grid">
      <div
        class="qrcode-card"
        v-for="eq in list"
        :key="eq.id"
      >
        <div class="card-qr">
          <img v-if="qrCodeImages[eq.id]" :src="qrCodeImages[eq.id]" class="qr-img" />
          <div v-else class="qr-placeholder">
            <el-icon :size="32" color="#c0c4cc"><PictureFilled /></el-icon>
          </div>
        </div>

        <div class="card-info">
          <span class="card-code">{{ eq.code }}</span>
          <span class="card-name">{{ eq.name }}</span>
          <span class="card-dept">{{ eq.department || '-' }}</span>
        </div>

        <div class="card-actions">
          <el-button size="small" @click.stop="handleDownloadOne(eq)">
            <el-icon><Download /></el-icon> 下载
          </el-button>
        </div>
      </div>

      <div v-if="list.length === 0 && !loading" class="empty-state">
        <el-icon :size="64" color="#c0c4cc"><PictureFilled /></el-icon>
        <p>暂无设备</p>
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
/* ====== 搜索栏 ====== */
.search-bar {
  display: flex;
  gap: 12px;
  padding: 0 20px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-input {
  max-width: 360px;
}

/* ====== 卡片网格 ====== */
.qrcode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  padding: 0 20px 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.qrcode-card {
  position: relative;
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  border: 2px solid transparent;
}

.qrcode-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-qr {
  width: 140px;
  height: 140px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  border-radius: 6px;
  overflow: hidden;
}

.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 14px;
}

.card-code {
  font-size: 13px;
  font-weight: 600;
  color: #409EFF;
}

.card-name {
  font-size: 14px;
  color: #303133;
}

.card-dept {
  font-size: 12px;
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* ====== 空状态 ====== */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

/* ====== 移动端优化 ====== */
@media (max-width: 768px) {
  .search-bar {
    padding: 0 12px 12px;
    flex-direction: column;
  }

  .search-input {
    max-width: none;
  }

  .qrcode-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 0 12px 12px;
  }

  .qrcode-card {
    padding: 14px;
  }

  .card-qr {
    width: 110px;
    height: 110px;
  }

  .card-actions {
    flex-direction: column;
    gap: 6px;
  }

  .card-actions .el-button {
    width: 100%;
  }
}
</style>