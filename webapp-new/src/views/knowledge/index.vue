<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentUser, loadFromStorage, isLoggedIn } from '@/stores/user'
import { getKnowledgeList, deleteKnowledge, type KnowledgeItem, getImageUrl } from '@/api/knowledge'

const router = useRouter()

const categories = [
  { id: 'all', label: '全部', icon: 'Grid' },
  { id: 'workflow', label: '工作流程', icon: 'Connection' },
  { id: 'tech', label: '技术分享', icon: 'Monitor' },
  { id: 'tools', label: '工具技巧', icon: 'Setting' },
  { id: 'bestpractice', label: '最佳实践', icon: 'Medal' },
]

const searchTerm = ref('')
const selectedCategory = ref('all')
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const total = ref(0)
const knowledges = ref<KnowledgeItem[]>([])
const currentUser = ref<{ id: string; realName?: string; username?: string } | null>(null)

function getCategoryLabel(id: string) {
  return categories.find(c => c.id === id)?.label || id
}

async function loadData() {
  loading.value = true
  try {
    const res = await getKnowledgeList({
      page: page.value,
      pageSize: pageSize.value,
      category: selectedCategory.value !== 'all' ? selectedCategory.value : undefined,
      keyword: searchTerm.value.trim() || undefined
    })
    knowledges.value = res.data.list
    total.value = res.data.total
  } catch (err) {
    console.error('加载失败', err)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadData()
}

function changeCategory(category: string) {
  selectedCategory.value = category
  page.value = 1
  loadData()
}

function gotoDetail(item: KnowledgeItem) {
  router.push(`/knowledge/${item.id}`)
}

function gotoCreate() {
  router.push('/knowledge/new')
}

function handleEdit(item: KnowledgeItem, e: MouseEvent) {
  e.stopPropagation()
  router.push(`/knowledge/${item.id}/edit`)
}

function handleDelete(item: KnowledgeItem, e: MouseEvent) {
  e.stopPropagation()
  ElMessageBox.confirm(`确定删除「${item.title}」？删除后无法恢复。`, '确认删除', {
    type: 'warning'
  }).then(async () => {
    try {
      await deleteKnowledge(item.id)
      ElMessage.success('删除成功')
      loadData()
    } catch (err) {
      console.error('删除失败', err)
    }
  }).catch(() => {})
}

function handlePageChange(newPage: number) {
  page.value = newPage
  loadData()
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadData()
}

function getCoverUrl(item: KnowledgeItem): string | null {
  if (!item.images || item.images.length === 0) return null
  if (item.coverImageId) {
    const cover = item.images.find(img => img.id === item.coverImageId)
    if (cover) return getImageUrl(cover.url)
  }
  return getImageUrl(item.images[0].url)
}

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) return
  currentUser.value = getCurrentUser()
  loadData()
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
            @clear="handleSearch"
            @keyup.enter="handleSearch"
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
        @click="changeCategory(cat.id)"
      >
        <el-icon :size="16"><component :is="cat.icon" /></el-icon>
        {{ cat.label }}
      </span>
    </div>

    <!-- 操作栏 -->
    <div class="kb-toolbar">
      <span class="kb-count">共 {{ total }} 条知识</span>
      <el-button type="primary" @click="gotoCreate">
        <el-icon><Plus /></el-icon> 发布知识
      </el-button>
    </div>

    <!-- 信息流列表 -->
    <div class="kb-list" v-loading="loading">
      <div
        v-for="item in knowledges"
        :key="item.id"
        class="kb-card"
        @click="gotoDetail(item)"
      >
        <div class="kb-card-meta">
          <el-tag size="small" type="primary">{{ getCategoryLabel(item.category) }}</el-tag>
          <span class="kb-card-author">
            <el-icon :size="14"><User /></el-icon>
            {{ item.author }}
          </span>
          <span class="kb-card-date">{{ item.createdAt.slice(0, 10) }}</span>
        </div>

        <h2 class="kb-card-title">{{ item.title }}</h2>

        <div class="kb-card-content-row">
          <div class="kb-card-summary">
            {{ item.summary || item.content.slice(0, 150) }}
            {{ (item.summary || item.content).length > 150 ? '...' : '' }}
          </div>
          <div v-if="getCoverUrl(item)" class="kb-card-cover">
            <img :src="getCoverUrl(item)" alt="封面" />
          </div>
        </div>

        <div class="kb-card-tags" v-if="item.tags.length > 0">
          <el-tag
            v-for="tag in item.tags"
            :key="tag"
            size="small"
            type="info"
            class="kb-tag"
          >{{ tag }}</el-tag>
        </div>

        <div class="kb-card-footer">
          <div class="kb-stats">
            <span class="kb-stat">
              <el-icon><ThumbUp /></el-icon>
              {{ item.likeCount || 0 }}
            </span>
            <span class="kb-stat">
              <el-icon><ChatDotRound /></el-icon>
              {{ item.commentCount || 0 }}
            </span>
          </div>
          <div class="kb-actions" v-if="currentUser && currentUser.id === item.authorId">
            <el-button text size="small" @click="handleEdit(item, $event)">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-button text size="small" type="danger" @click="handleDelete(item, $event)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="total === 0 && !loading" class="kb-empty">
        <el-icon :size="64" color="#c0c4cc"><Reading /></el-icon>
        <p>{{ searchTerm || selectedCategory !== 'all' ? '没有找到匹配的知识条目' : '还没有知识记录，点击上方按钮发布第一条知识' }}</p>
        <el-button type="primary" size="large" @click="gotoCreate" style="margin-top: 20px;">
          发布第一条知识
        </el-button>
      </div>
    </div>

    <!-- 分页 -->
    <div class="kb-pagination" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>
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

/* ====== 信息流列表 ====== */
.kb-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  transition: all 0.2s;
  cursor: pointer;
}

.kb-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.kb-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.kb-card-author {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: #909399;
}

.kb-card-date {
  font-size: 13px;
  color: #c0c4cc;
}

.kb-card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
  line-height: 1.4;
  transition: color 0.2s;
}

.kb-card:hover .kb-card-title {
  color: #409EFF;
}

.kb-card-content-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.kb-card-summary {
  flex: 1;
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-card-cover {
  flex-shrink: 0;
  width: 120px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f7fa;
}

.kb-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.kb-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.kb-tag {
  font-size: 12px;
}

.kb-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.kb-stats {
  display: flex;
  gap: 24px;
}

.kb-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #909399;
}

.kb-actions {
  display: flex;
  gap: 8px;
}

/* ====== 空状态 ====== */
.kb-empty {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.kb-empty p {
  margin-top: 12px;
  font-size: 14px;
}

/* ====== 分页 ====== */
.kb-pagination {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
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

html.dark .kb-card-title {
  color: #e5eaf3;
}

html.dark .kb-card:hover .kb-card-title {
  color: #409EFF;
}

html.dark .kb-card-summary {
  color: #a3a6ad;
}

html.dark .kb-card-footer {
  border-color: #363637;
}

html.dark .kb-card-date,
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

  .kb-card-content-row {
    flex-direction: column;
  }

  .kb-card-cover {
    width: 100%;
    height: 160px;
  }

  .kb-card-footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .kb-pagination {
    justify-content: center;
  }
}
</style>