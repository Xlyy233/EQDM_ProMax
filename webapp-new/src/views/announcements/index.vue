<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { hasRole } from '@/stores/user'
import type { Announcement } from '@/types'
import * as api from '@/api/announcement'
import dayjs from 'dayjs'

const list = ref<Announcement[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const showDialog = ref(false)
const editingId = ref('')
const form = ref({ title: '', content: '', isActive: true })
const submitting = ref(false)
const viewingId = ref('')
const viewingContent = ref('')
const showViewDialog = ref(false)

const canManage = hasRole(['admin', 'manager'])

function loadData() {
  loading.value = true
  api.getAnnouncements({ page: page.value, pageSize: pageSize.value }).then(res => {
    list.value = res.data.data?.list || []
    total.value = res.data.data?.total || 0
  }).catch(() => {}).finally(() => { loading.value = false })
}

function openAdd() {
  editingId.value = ''
  form.value = { title: '', content: '', isActive: true }
  showDialog.value = true
}

function openEdit(item: Announcement) {
  editingId.value = item.id
  form.value = { title: item.title, content: item.content, isActive: item.isActive }
  showDialog.value = true
}

function handleSave() {
  if (!form.value.title.trim()) { ElMessage.warning('请输入公告标题'); return }
  if (!form.value.content.trim()) { ElMessage.warning('请输入公告内容'); return }
  submitting.value = true
  const promise = editingId.value
    ? api.updateAnnouncement(editingId.value, form.value)
    : api.createAnnouncement(form.value)
  promise.then(() => {
    ElMessage.success(editingId.value ? '公告已更新' : '公告已发布')
    showDialog.value = false
    loadData()
  }).catch(() => {}).finally(() => { submitting.value = false })
}

function handleDelete(item: Announcement) {
  ElMessageBox.confirm('确定删除公告「' + item.title + '」？', '确认', { type: 'warning' }).then(() => {
    api.deleteAnnouncement(item.id).then(() => { ElMessage.success('已删除'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function handleView(item: Announcement) {
  viewingId.value = item.id
  viewingContent.value = item.content
  showViewDialog.value = true
}

function formatDate(str: string) {
  return str ? dayjs(str).format('YYYY-MM-DD HH:mm') : '-'
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统公告</h2>
      <el-button v-if="canManage" type="primary" @click="openAdd"><el-icon><Plus /></el-icon>发布公告</el-button>
    </div>

    <div v-loading="loading" class="announcement-list">
      <div v-if="list.length === 0" class="empty-state">
        <p>暂无公告</p>
      </div>
      <div
        v-for="item in list"
        :key="item.id"
        class="announcement-card"
        :class="{ inactive: !item.isActive }"
      >
        <div class="card-header">
          <div class="card-title-row">
            <h3 class="card-title" @click="handleView(item)">{{ item.title }}</h3>
            <el-tag :type="item.isActive ? 'success' : 'info'" size="small">
              {{ item.isActive ? '展示中' : '已隐藏' }}
            </el-tag>
          </div>
          <div class="card-meta">
            <span>{{ item.createdByName }}</span>
            <span>{{ formatDate(item.createdAt) }}</span>
          </div>
        </div>
        <div class="card-preview" @click="handleView(item)">
          {{ item.content.slice(0, 150) }}{{ item.content.length > 150 ? '...' : '' }}
        </div>
        <div v-if="canManage" class="card-actions">
          <el-button size="small" @click="openEdit(item)"><el-icon><Edit /></el-icon>编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)"><el-icon><Delete /></el-icon>删除</el-button>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:16px;" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="loadData"
      />
    </div>

    <!-- 发布/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="editingId ? '编辑公告' : '发布公告'" width="600px" :close-on-click-modal="false">
      <el-form label-width="80px" :disabled="submitting">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入公告标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="请输入公告内容" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="展示" inactive-text="隐藏" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="submitting">发布</el-button>
      </template>
    </el-dialog>

    <!-- 查看详情弹窗 -->
    <el-dialog v-model="showViewDialog" title="公告详情" width="600px">
      <div style="white-space:pre-wrap;line-height:1.8;font-size:14px;color:#303133;">{{ viewingContent }}</div>
    </el-dialog>
  </div>
</template>

<style scoped>
.announcement-list {
  padding: 0 20px;
  max-width: 900px;
  margin: 0 auto;
}

.announcement-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 14px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  transition: all 0.2s;
}

.announcement-card.inactive {
  opacity: 0.6;
}

.card-header {
  margin-bottom: 12px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  cursor: pointer;
  margin: 0;
}

.card-title:hover {
  color: #409EFF;
}

.card-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 12px;
}

.card-preview {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  cursor: pointer;
  padding: 10px 0;
  border-top: 1px solid #ebeef5;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

@media (max-width: 768px) {
  .announcement-list {
    padding: 0 12px;
  }
  .announcement-card {
    padding: 16px;
  }
}
</style>