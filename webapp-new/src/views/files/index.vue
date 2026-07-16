<template>
  <div class="file-share-page">
    <!-- 顶部栏 -->
    <div class="file-topbar">
      <div class="file-search">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件名、设备编号、设备名称、描述、上传者..."
          prefix-icon="Search"
          clearable
          @input="handleSearch"
          @clear="handleSearch"
        />
      </div>
      <div class="file-toolbar">
        <el-select v-model="sortBy" style="width:140px;" @change="handleSearch">
          <el-option label="最新上传" value="uploadTime-desc" />
          <el-option label="最早上传" value="uploadTime-asc" />
          <el-option label="文件名 A→Z" value="name-asc" />
          <el-option label="文件名 Z→A" value="name-desc" />
          <el-option label="大小 ↓" value="size-desc" />
          <el-option label="大小 ↑" value="size-asc" />
          <el-option label="下载次数 ↓" value="download-desc" />
        </el-select>
        <el-button type="primary" @click="openUploadDialog">
          <el-icon><Upload /></el-icon>上传文件
        </el-button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="file-main">
      <!-- 侧边栏 -->
      <div class="file-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">文件分类</div>
          <div
            v-for="cat in categories"
            :key="cat"
            :class="['sidebar-item', { active: filterType === 'category' && filterValue === cat }]"
            @click="filterByCategory(cat)"
          >
            <span>{{ cat }}</span>
            <span class="count">{{ getCategoryCount(cat) }}</span>
          </div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-title">按设备筛选</div>
          <div v-if="deviceList.length === 0" class="sidebar-empty">暂无关联设备</div>
          <div
            v-for="d in deviceList"
            :key="d.code"
            :class="['sidebar-item', { active: filterType === 'device' && filterValue === d.code }]"
            @click="filterByDevice(d.code)"
          >
            <span>{{ d.code }}<small v-if="d.name"> {{ d.name }}</small></span>
            <span class="count">{{ d.count }}</span>
          </div>
        </div>
        <div class="storage-card">
          <h4>存储使用情况</h4>
          <div class="storage-bar">
            <div class="storage-bar-fill" :style="{ width: storagePct + '%' }"></div>
          </div>
          <div class="storage-info">已用 {{ formatSize(totalSize) }} / {{ formatSize(100 * 1024 * 1024 * 1024) }}</div>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="file-content">
        <!-- 拖拽上传区 -->
        <div
          :class="['dropzone', { collapsed: dropzoneCollapsed }]"
          @click="uploadDialogVisible = true"
          @dragover.prevent
          @dragenter.prevent="dropzoneHover = true"
          @dragleave="dropzoneHover = false"
          @drop.prevent="onDrop"
        >
          <div class="dropzone-header">
            <h3>将文件拖拽到此处上传</h3>
            <el-button text size="small" @click.stop="dropzoneCollapsed = !dropzoneCollapsed">
              {{ dropzoneCollapsed ? '展开' : '收起' }}
            </el-button>
          </div>
          <div v-show="!dropzoneCollapsed" class="dropzone-content">
            <el-icon :size="32" color="#1e6fff"><UploadFilled /></el-icon>
            <p>支持任意格式，单个文件无大小限制。也可点击"上传文件"按钮选择文件。</p>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="selectedIds.size > 0" class="batch-bar">
          <span>已选 <strong>{{ selectedIds.size }}</strong> 个文件</span>
          <div class="batch-actions">
            <el-button size="small" @click="clearSelection">取消选择</el-button>
            <el-button size="small" type="primary" @click="batchDownload">批量下载</el-button>
            <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
          </div>
        </div>

        <!-- 文件列表 -->
        <div class="file-table-wrapper">
          <div class="file-table-header">
            <el-checkbox v-model="selectAll" @change="onSelectAll" />
            <span class="col-name">文件名</span>
            <span class="col-cat">分类</span>
            <span class="col-dev">关联设备</span>
            <span class="col-size">大小</span>
            <span class="col-uploader">上传者 / 时间</span>
            <span class="col-dl">下载</span>
            <span class="col-act">操作</span>
          </div>

          <div v-if="filteredFiles.length === 0" class="empty-state">
            <el-icon :size="48"><FolderOpened /></el-icon>
            <h3>暂无文件</h3>
            <p>点击"上传文件"或拖拽文件到上方区域</p>
          </div>

          <div
            v-for="f in filteredFiles"
            :key="f.id"
            class="file-row"
          >
            <el-checkbox :model-value="selectedIds.has(f.id)" @change="toggleSelect(f.id)" />
            <div class="col-name">
              <span :class="['file-icon', getIconClass(f.name)]">{{ getIconLabel(f.name) }}</span>
              <div class="file-name-info">
                <span class="file-name-text" @click="openPreview(f)">{{ f.name }}</span>
                <span v-if="f.description" class="file-desc">{{ f.description }}</span>
              </div>
            </div>
            <span class="col-cat">{{ f.category || '其他' }}</span>
            <span class="col-dev">{{ f.deviceCode ? `${f.deviceCode} ${f.deviceName || ''}` : '-' }}</span>
            <span class="col-size">{{ formatSize(f.size) }}</span>
            <span class="col-uploader">
              <div>{{ f.uploader || '-' }}</div>
              <div class="time-text">{{ formatDate(f.uploadTime) }}</div>
            </span>
            <span class="col-dl">{{ f.downloadCount || 0 }} 次</span>
            <span class="col-act">
              <el-button size="small" @click="downloadFile(f)">下载</el-button>
              <el-button size="small" type="danger" @click="handleDelete(f)">删除</el-button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="500px" :close-on-click-modal="false">
      <div class="upload-dialog">
        <el-upload
          ref="uploadRef"
          drag
          multiple
          :auto-upload="false"
          :on-change="onUploadChange"
          :file-list="uploadFileList"
        >
          <el-icon :size="40"><UploadFilled /></el-icon>
          <div class="el-upload__text">将文件拖到此处或<em>点击选择</em></div>
        </el-upload>
        <el-form label-width="80px" style="margin-top:16px;">
          <el-form-item label="分类">
            <el-select v-model="uploadForm.category" style="width:100%;">
              <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="设备编号">
                <el-input v-model="uploadForm.deviceCode" placeholder="例如 EQ-001" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="设备名称">
                <el-input v-model="uploadForm.deviceName" placeholder="例如 数控车床" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="描述">
            <el-input v-model="uploadForm.description" type="textarea" :rows="2" placeholder="简要说明文件用途" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="doUpload">开始上传</el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog v-model="previewVisible" :title="previewFile?.name" width="90%" :close-on-click-modal="true">
      <div v-if="previewFile" class="preview-body">
        <img v-if="isImagePreview" :src="previewUrl" :alt="previewFile.name" style="max-width:100%;max-height:70vh;display:block;" />
        <iframe v-else-if="previewFile.name.endsWith('.pdf')" :src="previewUrl" style="width:100%;height:70vh;border:none;" />
        <pre v-else-if="isTextPreview">{{ previewContent }}</pre>
        <div v-else class="preview-unsupported">
          <el-icon :size="48"><Document /></el-icon>
          <h3>该文件类型不支持在线预览</h3>
          <p>请下载文件后查看</p>
          <el-button type="primary" @click="downloadFile(previewFile)">下载文件</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, UploadFilled, FolderOpened, Document } from '@element-plus/icons-vue'
import {
  getFileList, uploadFile, deleteFile, batchDeleteFiles,
  downloadFileWithAuth, batchDownloadFiles, type FileShare
} from '@/api/file'

const files = ref<FileShare[]>([])
const searchKeyword = ref('')
const sortBy = ref('uploadTime-desc')
const filterType = ref('all')
const filterValue = ref('')
const selectedIds = ref(new Set<string>())
const selectAll = ref(false)
const dropzoneCollapsed = ref(false)
const dropzoneHover = ref(false)
const uploading = ref(false)

// 上传对话框
const uploadDialogVisible = ref(false)
const uploadRef = ref()
const uploadFileList = ref<any[]>([])
const uploadForm = ref({ category: '设备档案', deviceCode: '', deviceName: '', description: '' })

// 预览
const previewVisible = ref(false)
const previewFile = ref<FileShare | null>(null)
const previewContent = ref('')

const categories = ['设备档案', '维护手册', '操作规程', '备件清单', '巡检记录', '点检表', '培训资料', '维修报告', '其他']

const iconMap: Record<string, { cls: string; label: string }> = {
  pdf: { cls: 'fi-pdf', label: 'PDF' },
  doc: { cls: 'fi-doc', label: 'DOC' }, docx: { cls: 'fi-doc', label: 'DOC' },
  xls: { cls: 'fi-xls', label: 'XLS' }, xlsx: { cls: 'fi-xls', label: 'XLS' }, csv: { cls: 'fi-xls', label: 'CSV' },
  png: { cls: 'fi-img', label: 'IMG' }, jpg: { cls: 'fi-img', label: 'IMG' }, jpeg: { cls: 'fi-img', label: 'IMG' },
  gif: { cls: 'fi-img', label: 'IMG' }, bmp: { cls: 'fi-img', label: 'IMG' }, webp: { cls: 'fi-img', label: 'IMG' }, svg: { cls: 'fi-img', label: 'IMG' },
  zip: { cls: 'fi-zip', label: 'ZIP' }, rar: { cls: 'fi-zip', label: 'ZIP' }, '7z': { cls: 'fi-zip', label: 'ZIP' },
  tar: { cls: 'fi-zip', label: 'ZIP' }, gz: { cls: 'fi-zip', label: 'ZIP' },
  txt: { cls: 'fi-txt', label: 'TXT' }, log: { cls: 'fi-txt', label: 'LOG' }, md: { cls: 'fi-txt', label: 'MD' },
  py: { cls: 'fi-py', label: 'CODE' }, js: { cls: 'fi-py', label: 'CODE' }, ts: { cls: 'fi-py', label: 'CODE' },
  java: { cls: 'fi-py', label: 'CODE' }, c: { cls: 'fi-py', label: 'CODE' }, cpp: { cls: 'fi-py', label: 'CODE' },
  go: { cls: 'fi-py', label: 'CODE' }, rs: { cls: 'fi-py', label: 'CODE' }
}

const textExts = ['txt', 'log', 'md', 'json', 'csv', 'py', 'js', 'ts', 'xml', 'yml', 'yaml', 'ini', 'conf', 'env', 'sh', 'bat', 'ps1']
const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']

function getExt(name: string) { return (name.split('.').pop() || '').toLowerCase() }
function getIconClass(name: string) { return (iconMap[getExt(name)] || { cls: 'fi-default', label: 'FILE' }).cls }
function getIconLabel(name: string) { return (iconMap[getExt(name)] || { cls: 'fi-default', label: getExt(name).toUpperCase().slice(0, 3) || 'FILE' }).label }
function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2) + ' ' + units[i]
}
function formatDate(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 文件列表
const deviceList = computed(() => {
  const map: Record<string, { name: string; count: number }> = {}
  files.value.forEach(f => {
    if (f.deviceCode) {
      if (!map[f.deviceCode]) map[f.deviceCode] = { name: f.deviceName || '', count: 0 }
      map[f.deviceCode].count++
    }
  })
  return Object.entries(map).map(([code, v]) => ({ code, name: v.name, count: v.count }))
    .sort((a, b) => a.code.localeCompare(b.code))
})

const totalSize = computed(() => files.value.reduce((s, f) => s + (f.size || 0), 0))
const storagePct = computed(() => Math.min(100, (totalSize.value / (100 * 1024 * 1024 * 1024)) * 100))

const filteredFiles = computed(() => {
  let list = files.value
  if (filterType.value === 'category') list = list.filter(f => (f.category || '其他') === filterValue.value)
  else if (filterType.value === 'device') list = list.filter(f => f.deviceCode === filterValue.value)
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(f => [f.name, f.deviceCode, f.deviceName, f.description, f.uploader, f.category]
      .filter(Boolean).join(' ').toLowerCase().includes(kw))
  }
  const [field, dir] = sortBy.value.split('-')
  const mul = dir === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    let av: any = a[field as keyof FileShare]
    let bv: any = b[field as keyof FileShare]
    if (field === 'uploadTime') { av = new Date(av || 0).getTime(); bv = new Date(bv || 0).getTime() }
    else if (field === 'size') { av = av || 0; bv = bv || 0 }
    else { av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase() }
    return (av < bv ? -1 : av > bv ? 1 : 0) * mul
  })
})

function getCategoryCount(cat: string) {
  return files.value.filter(f => (f.category || '其他') === cat).length
}

async function loadFiles() {
  try {
    const res = await getFileList()
    files.value = res.files || []
  } catch { /* ignore */ }
}

function filterByCategory(cat: string) {
  filterType.value = 'category'; filterValue.value = cat
}
function filterByDevice(code: string) {
  filterType.value = 'device'; filterValue.value = code
}
function handleSearch() {
  filterType.value = 'all'; filterValue.value = ''
}

// 选择
function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
  selectAll.value = filteredFiles.value.length > 0 && filteredFiles.value.every(f => s.has(f.id))
}
function onSelectAll(v: boolean) {
  const s = new Set<string>()
  if (v) filteredFiles.value.forEach(f => s.add(f.id))
  selectedIds.value = s
}
function clearSelection() { selectedIds.value = new Set(); selectAll.value = false }

// 上传
function openUploadDialog() {
  uploadFileList.value = []
  uploadDialogVisible.value = true
}
function onUploadChange(_file: any, fileList: any[]) {
  uploadFileList.value = fileList
}
function onDrop(e: DragEvent) {
  const dt = e.dataTransfer
  if (dt?.files.length) {
    uploadFileList.value = Array.from(dt.files).map((f: File) => ({
      name: f.name, size: f.size, raw: f
    }))
    uploadDialogVisible.value = true
  }
}
async function doUpload() {
  const rawFiles = uploadFileList.value.map((f: any) => f.raw).filter(Boolean)
  if (rawFiles.length === 0) { ElMessage.warning('请选择文件'); return }
  uploading.value = true
  try {
    const formData = new FormData()
    rawFiles.forEach((f: File) => formData.append('files', f))
    formData.append('category', uploadForm.value.category)
    formData.append('deviceCode', uploadForm.value.deviceCode)
    formData.append('deviceName', uploadForm.value.deviceName)
    formData.append('description', uploadForm.value.description)
    await uploadFile(formData)
    ElMessage.success(`成功上传 ${rawFiles.length} 个文件`)
    uploadDialogVisible.value = false
    uploadFileList.value = []
    uploadForm.value = { category: '设备档案', deviceCode: '', deviceName: '', description: '' }
    loadFiles()
  } catch (e: any) {
    ElMessage.error('上传失败: ' + (e.message || ''))
  } finally {
    uploading.value = false
  }
}

// 下载
async function downloadFile(f: FileShare) {
  try {
    const blob = await downloadFileWithAuth(f.name)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(a.href)
    f.downloadCount++
    setTimeout(loadFiles, 1000)
  } catch { ElMessage.error('下载失败') }
}
async function batchDownload() {
  const names = Array.from(selectedIds.value).map(id => files.value.find(f => f.id === id)?.name).filter(Boolean) as string[]
  if (names.length === 0) return
  try {
    const blob = await batchDownloadFiles(names)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `设备文件_${new Date().toISOString().slice(0, 10)}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(a.href)
    ElMessage.success(`已下载 ${names.length} 个文件`)
    setTimeout(loadFiles, 2000)
  } catch { ElMessage.error('批量下载失败') }
}

// 删除
async function handleDelete(f: FileShare) {
  try {
    await ElMessageBox.confirm(`确定删除文件 "${f.name}" 吗？此操作不可撤销。`, '确认删除', { type: 'warning' })
    await deleteFile(f.name)
    ElMessage.success('已删除')
    selectedIds.value.delete(f.id)
    selectedIds.value = new Set(selectedIds.value)
    loadFiles()
  } catch { /* cancelled */ }
}
async function batchDelete() {
  const names = Array.from(selectedIds.value).map(id => files.value.find(f => f.id === id)?.name).filter(Boolean) as string[]
  if (names.length === 0) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${names.length} 个文件吗？`, '批量删除', { type: 'warning' })
    await batchDeleteFiles(names)
    ElMessage.success(`已删除 ${names.length} 个文件`)
    selectedIds.value = new Set()
    selectAll.value = false
    loadFiles()
  } catch { /* cancelled */ }
}

// 预览
const previewUrl = ref('')
const isImagePreview = computed(() => previewFile.value ? imageExts.includes(getExt(previewFile.value.name)) : false)
const isTextPreview = computed(() => previewFile.value ? textExts.includes(getExt(previewFile.value.name)) : false)

async function openPreview(f: FileShare) {
  previewFile.value = f
  previewUrl.value = ''
  previewContent.value = ''
  previewVisible.value = true
  const ext = getExt(f.name)
  try {
    if (isTextPreview.value) {
      const blob = await downloadFileWithAuth(f.name)
      const text = await blob.text()
      previewContent.value = text.slice(0, 200000) + (text.length > 200000 ? '\n\n... (内容过长已截断)' : '')
    } else {
      const blob = await downloadFileWithAuth(f.name)
      previewUrl.value = URL.createObjectURL(blob)
    }
  } catch {
    if (isTextPreview.value) previewContent.value = '无法加载预览'
    else previewUrl.value = ''
  }
}

onMounted(loadFiles)
</script>

<style scoped>
.file-share-page {
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-topbar {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  align-items: center;
  flex-shrink: 0;
}
.file-search { flex: 1; min-width: 200px; }
.file-toolbar { display: flex; gap: 8px; align-items: center; }

.file-main {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

/* 侧边栏 */
.file-sidebar {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 12px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.sidebar-section { margin-bottom: 16px; }
.sidebar-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
  padding: 4px 8px;
  margin-bottom: 4px;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
  transition: all 0.15s;
}
.sidebar-item:hover { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.sidebar-item.active { background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 500; }
.sidebar-item .count { margin-left: auto; font-size: 12px; background: var(--el-fill-color-light); padding: 0 8px; border-radius: 10px; }
.sidebar-item.active .count { background: var(--el-color-primary); color: #fff; }
.sidebar-empty { font-size: 12px; color: var(--el-text-color-placeholder); padding: 8px 10px; }
.sidebar-item small { font-size: 11px; color: var(--el-text-color-placeholder); }

.storage-card {
  padding: 12px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-fill-color-light));
  border-radius: 8px;
  margin-top: 8px;
}
.storage-card h4 { font-size: 12px; color: var(--el-text-color-secondary); margin: 0 0 8px; }
.storage-bar { height: 6px; background: rgba(30, 111, 255, 0.15); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.storage-bar-fill { height: 100%; background: var(--el-color-primary); transition: width 0.3s; }
.storage-info { font-size: 11px; color: var(--el-text-color-secondary); }

/* 内容区 */
.file-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-left: 16px;
}

/* 拖拽区 */
.dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.dropzone:hover, .dropzone:focus-within { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.dropzone.collapsed { padding: 10px 16px; }
.dropzone.collapsed .dropzone-content { display: none; }
.dropzone-header { display: flex; align-items: center; justify-content: space-between; }
.dropzone-header h3 { margin: 0; font-size: 14px; }
.dropzone-content { margin-top: 8px; }
.dropzone-content p { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; }

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  flex-shrink: 0;
}
.batch-bar span { color: var(--el-color-primary); font-weight: 500; }
.batch-actions { margin-left: auto; display: flex; gap: 8px; }

/* 文件列表 */
.file-table-wrapper { flex: 1; overflow-y: auto; }
.file-table-header {
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 0.8fr 1.2fr 0.8fr 160px;
  align-items: center;
  padding: 8px 16px;
  background: #f8fafc;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: none;
}
.file-row {
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 0.8fr 1.2fr 0.8fr 160px;
  align-items: center;
  padding: 10px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-top: none;
  font-size: 13px;
  transition: background 0.15s;
}
.file-row:hover { background: #fafbfc; }
.file-row:last-child { border-radius: 0 0 6px 6px; }

.col-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.file-icon {
  width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: #fff; font-weight: 600; flex-shrink: 0;
}
.file-name-info { overflow: hidden; }
.file-name-text { cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.file-name-text:hover { color: var(--el-color-primary); }
.file-desc { font-size: 11px; color: var(--el-text-color-placeholder); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.col-cat, .col-size, .col-dl { color: var(--el-text-color-secondary); font-size: 12px; }
.col-dev { font-size: 12px; }
.col-uploader { font-size: 12px; color: var(--el-text-color-secondary); }
.col-uploader .time-text { font-size: 11px; color: var(--el-text-color-placeholder); }
.col-act { display: flex; gap: 4px; justify-content: flex-end; }

.empty-state { text-align: center; padding: 60px 20px; color: var(--el-text-color-placeholder); }
.empty-state h3 { font-size: 15px; color: var(--el-text-color-secondary); margin: 12px 0 6px; }
.empty-state p { font-size: 13px; }

/* 文件图标颜色 */
.fi-pdf { background: #ef4444; }
.fi-doc { background: #2563eb; }
.fi-xls { background: #16a34a; }
.fi-img { background: #8b5cf6; }
.fi-zip { background: #f59e0b; }
.fi-txt { background: #64748b; }
.fi-py { background: #3776ab; }
.fi-default { background: #94a3b8; }

.preview-unsupported { text-align: center; padding: 40px; color: var(--el-text-color-secondary); }
.preview-unsupported h3 { margin: 12px 0 8px; }
.preview-body pre {
  background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 6px;
  overflow: auto; max-height: 70vh; font-size: 12px; font-family: Consolas, monospace;
}

@media (max-width: 860px) {
  .file-sidebar { display: none; }
  .file-content { padding-left: 0; }
  .file-table-header, .file-row {
    grid-template-columns: 40px 1fr 80px 120px;
  }
  .col-cat, .col-dev, .col-size, .col-dl { display: none; }
}
</style>