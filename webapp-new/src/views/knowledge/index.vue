<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentUser, loadFromStorage, isLoggedIn } from '@/stores/user'

interface Knowledge {
  id: string
  title: string
  content: string
  category: string
  author: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

const categories = [
  { id: 'all', label: '全部', icon: 'Grid' },
  { id: 'workflow', label: '工作流程', icon: 'Connection' },
  { id: 'tech', label: '技术分享', icon: 'Monitor' },
  { id: 'tools', label: '工具技巧', icon: 'Setting' },
  { id: 'bestpractice', label: '最佳实践', icon: 'Medal' },
]

const STORAGE_KEY = 'eqdm_knowledge_base'

const searchTerm = ref('')
const selectedCategory = ref('all')
const knowledges = ref<Knowledge[]>([])
const showModal = ref(false)
const editingItem = ref<Knowledge | null>(null)
const expandedIds = ref<Set<string>>(new Set())

// 编辑表单
const form = ref({
  title: '',
  content: '',
  category: 'tech',
  author: '',
  tags: ''
})

const editableCategories = computed(() => categories.filter(c => c.id !== 'all'))

const filteredKnowledges = computed(() => {
  return knowledges.value.filter(item => {
    const term = searchTerm.value.toLowerCase()
    const matchesSearch = !term ||
      item.title.toLowerCase().includes(term) ||
      item.content.toLowerCase().includes(term) ||
      item.tags.some(t => t.toLowerCase().includes(term))
    const matchesCategory = selectedCategory.value === 'all' || item.category === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    knowledges.value = raw ? JSON.parse(raw) : []
  } catch {
    knowledges.value = []
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(knowledges.value))
}

function openAdd() {
  editingItem.value = null
  form.value = { title: '', content: '', category: 'tech', author: '', tags: '' }
  showModal.value = true
}

function openEdit(item: Knowledge) {
  editingItem.value = item
  form.value = {
    title: item.title,
    content: item.content,
    category: item.category,
    author: item.author,
    tags: item.tags.join(', ')
  }
  showModal.value = true
}

function handleSubmit() {
  if (!form.value.title.trim() || !form.value.content.trim() || !form.value.author.trim()) {
    ElMessage.warning('请填写标题、内容和作者')
    return
  }
  const now = new Date().toISOString().split('T')[0]
  const tags = form.value.tags.split(',').map(t => t.trim()).filter(Boolean)

  if (editingItem.value) {
    const idx = knowledges.value.findIndex(k => k.id === editingItem.value!.id)
    if (idx >= 0) {
      knowledges.value[idx] = {
        ...knowledges.value[idx],
        title: form.value.title.trim(),
        content: form.value.content.trim(),
        category: form.value.category,
        author: form.value.author.trim(),
        tags,
        updatedAt: now
      }
    }
    ElMessage.success('更新成功')
  } else {
    knowledges.value.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      category: form.value.category,
      author: form.value.author.trim(),
      tags,
      createdAt: now,
      updatedAt: now
    })
    ElMessage.success('添加成功')
  }
  saveData()
  showModal.value = false
}

function handleDelete(item: Knowledge) {
  ElMessageBox.confirm(`确定删除「${item.title}」？`, '确认', { type: 'warning' }).then(() => {
    knowledges.value = knowledges.value.filter(k => k.id !== item.id)
    saveData()
    ElMessage.success('删除成功')
  }).catch(() => {})
}

function toggleExpand(id: string) {
  const newSet = new Set(expandedIds.value)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  expandedIds.value = newSet
}

function isExpanded(id: string) {
  return expandedIds.value.has(id)
}

function getCategoryLabel(id: string) {
  return categories.find(c => c.id === id)?.label || id
}

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) return
  loadData()
  const user = getCurrentUser()
  if (user) {
    form.value.author = user.realName || user.username || ''
  }
})
</script>

<template>
  <div class="page-container">
    <!-- 头部 -->
    <div class="kb-header">
      <div class="kb-header-inner">
        <div class="kb-header-title">
          <el-icon :size="28"><Reading /></el-icon>
          <div>
            <h1 class="kb-title">部门知识库</h1>
            <p class="kb-subtitle">分享工作经验，传承专业知识</p>
          </div>
        </div>
        <div class="kb-search">
          <el-input
            v-model="searchTerm"
            placeholder="搜索知识、技术、方法..."
            :prefix-icon="Search"
            size="large"
            clearable
          />
        </div>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="kb-categories">
      <span
        v-for="cat in categories"
        :key="cat.id"
        class="kb-cat-tab"
        :class="{ active: selectedCategory === cat.id }"
        @click="selectedCategory = cat.id"
      >
        <el-icon :size="16"><component :is="cat.icon" /></el-icon>
        {{ cat.label }}
      </span>
    </div>

    <!-- 操作栏 -->
    <div class="kb-toolbar">
      <span class="kb-count">共 {{ filteredKnowledges.length }} 条知识</span>
      <el-button type="primary" @click="openAdd">
        <el-icon><Plus /></el-icon> 添加知识
      </el-button>
    </div>

    <!-- 知识卡片列表 -->
    <div class="kb-grid">
      <div
        v-for="item in filteredKnowledges"
        :key="item.id"
        class="kb-card"
      >
        <div class="kb-card-header">
          <div class="kb-card-meta">
            <el-tag size="small" type="primary">{{ getCategoryLabel(item.category) }}</el-tag>
            <span class="kb-card-author">
              <el-icon :size="14"><User /></el-icon>
              {{ item.author }}
            </span>
          </div>
          <div class="kb-card-actions">
            <el-button text size="small" @click="openEdit(item)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button text size="small" type="danger" @click="handleDelete(item)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <h3 class="kb-card-title" @click="toggleExpand(item.id)">{{ item.title }}</h3>

        <div class="kb-card-tags" v-if="item.tags.length > 0">
          <el-tag
            v-for="tag in item.tags"
            :key="tag"
            size="small"
            type="info"
            class="kb-tag"
          >{{ tag }}</el-tag>
        </div>

        <div class="kb-card-body" :class="{ expanded: isExpanded(item.id) }">
          <div class="kb-card-content">{{ item.content }}</div>
        </div>

        <el-button
          v-if="item.content.length > 150"
          link
          type="primary"
          size="small"
          class="kb-expand-btn"
          @click="toggleExpand(item.id)"
        >
          <el-icon><component :is="isExpanded(item.id) ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          {{ isExpanded(item.id) ? '收起' : '展开全文' }}
        </el-button>

        <div class="kb-card-footer">
          <span class="kb-date">创建于 {{ item.createdAt }}</span>
          <span v-if="item.createdAt !== item.updatedAt" class="kb-date">更新于 {{ item.updatedAt }}</span>
        </div>
      </div>

      <div v-if="filteredKnowledges.length === 0" class="kb-empty">
        <el-icon :size="64" color="#c0c4cc"><Reading /></el-icon>
        <p>{{ searchTerm || selectedCategory !== 'all' ? '没有找到匹配的知识条目' : '还没有知识记录，点击上方按钮添加第一条知识' }}</p>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="showModal"
      :title="editingItem ? '编辑知识' : '添加知识'"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="60px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="请输入知识标题" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width:100%;">
            <el-option
              v-for="cat in editableCategories"
              :key="cat.id"
              :value="cat.id"
              :label="cat.label"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="作者" required>
          <el-input v-model="form.author" placeholder="请输入您的姓名" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="请详细描述您要分享的知识..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showModal = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ====== 头部 ====== */
.kb-header {
  background: linear-gradient(135deg, #409EFF, #6366f1);
  border-radius: 16px;
  margin: -4px -4px 20px;
  color: #fff;
}

.kb-header-inner {
  padding: 28px 32px;
}

.kb-header-title {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.kb-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.kb-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  opacity: 0.85;
}

.kb-search {
  max-width: 480px;
}

.kb-search :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  box-shadow: none;
}

.kb-search :deep(.el-input__inner) {
  color: #fff;
}

.kb-search :deep(.el-input__inner::placeholder) {
  color: rgba(255,255,255,0.6);
}

.kb-search :deep(.el-input__prefix) {
  color: rgba(255,255,255,0.6);
}

/* ====== 分类筛选 ====== */
.kb-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.kb-cat-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 22px;
  background: #f0f2f5;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.kb-cat-tab:hover {
  background: #e0e5ee;
  color: #409EFF;
}

.kb-cat-tab.active {
  background: #409EFF;
  color: #fff;
}

/* ====== 操作栏 ====== */
.kb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.kb-count {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

/* ====== 卡片网格 ====== */
.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.kb-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}

.kb-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.kb-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.kb-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.kb-card-author {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: #909399;
}

.kb-card-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.kb-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
  cursor: pointer;
  line-height: 1.4;
}

.kb-card-title:hover {
  color: #409EFF;
}

.kb-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.kb-tag {
  font-size: 12px;
}

.kb-card-body {
  max-height: 72px;
  overflow: hidden;
  transition: max-height 0.3s ease;
  margin-bottom: 8px;
}

.kb-card-body.expanded {
  max-height: 600px;
}

.kb-card-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
}

.kb-expand-btn {
  align-self: flex-start;
  margin-bottom: 8px;
  padding: 0;
}

.kb-card-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #c0c4cc;
}

.kb-date {
  white-space: nowrap;
}

/* ====== 空状态 ====== */
.kb-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.kb-empty p {
  margin-top: 12px;
  font-size: 14px;
}

/* ====== 深色模式 ====== */
html.dark .kb-header {
  background: linear-gradient(135deg, #1a3a5c, #312e81);
}

html.dark .kb-cat-tab {
  background: #262727;
  color: #a3a6ad;
}

html.dark .kb-cat-tab.active {
  background: #409EFF;
  color: #fff;
}

html.dark .kb-card {
  background: #1d1e1f;
  box-shadow: 0 1px 8px rgba(0,0,0,0.25);
}

html.dark .kb-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

html.dark .kb-card-title {
  color: #e5eaf3;
}

html.dark .kb-card-title:hover {
  color: #409EFF;
}

html.dark .kb-card-content {
  color: #a3a6ad;
}

html.dark .kb-card-footer {
  border-color: #363637;
}

html.dark .kb-date {
  color: #6b6e75;
}

html.dark .kb-card-author {
  color: #6b6e75;
}

html.dark .kb-count {
  color: #6b6e75;
}

/* ====== 移动端 ====== */
@media (max-width: 768px) {
  .kb-header {
    border-radius: 12px;
    margin: -12px -12px 16px;
  }

  .kb-header-inner {
    padding: 20px 18px;
  }

  .kb-title {
    font-size: 20px;
  }

  .kb-grid {
    grid-template-columns: 1fr;
  }

  .kb-categories {
    gap: 6px;
  }

  .kb-cat-tab {
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>