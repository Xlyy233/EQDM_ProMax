<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCurrentUser, loadFromStorage, isLoggedIn } from '@/stores/user'
import {
  getKnowledgeDetail,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  deleteKnowledge,
  type KnowledgeItem,
  type KnowledgeComment,
  getImageUrl
} from '@/api/knowledge'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(false)
const loadingComments = ref(false)
const item = ref<KnowledgeItem | null>(null)
const comments = ref<KnowledgeComment[]>([])
const newComment = ref('')
const submitting = ref(false)
const liked = ref(false)
const likeCount = ref(0)
const previewVisible = ref(false)
const previewImage = ref('')
const currentUser = ref<{ id: string; username?: string; realName?: string } | null>(null)

const categories = [
  { id: 'all', label: '全部', icon: 'Grid' },
  { id: 'workflow', label: '工作流程', icon: 'Connection' },
  { id: 'tech', label: '技术分享', icon: 'Monitor' },
  { id: 'tools', label: '工具技巧', icon: 'Setting' },
  { id: 'bestpractice', label: '最佳实践', icon: 'Medal' },
]

function getCategoryLabel(id: string) {
  return categories.find(c => c.id === id)?.label || id
}

async function loadData() {
  loading.value = true
  try {
    const res = await getKnowledgeDetail(id)
    if (!res.data) {
      ElMessage.error('文章不存在或已被删除')
      router.push('/knowledge')
      return
    }
    item.value = res.data
    liked.value = !!res.data.liked
    likeCount.value = res.data.likeCount || 0
  } catch (err) {
    console.error('加载失败', err)
    ElMessage.error('文章不存在或已被删除')
    router.push('/knowledge')
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  loadingComments.value = true
  try {
    const res = await getComments(id)
    comments.value = res.data
  } catch (err) {
    console.error('加载评论失败', err)
  } finally {
    loadingComments.value = false
  }
}

async function handleToggleLike() {
  try {
    const res = await toggleLike(id)
    liked.value = res.data.liked
    likeCount.value = res.data.likeCount
    ElMessage.success(res.data.liked ? '点赞成功' : '已取消点赞')
    if (item.value) {
      item.value.liked = res.data.liked
      item.value.likeCount = res.data.likeCount
    }
  } catch (err) {
    console.error('点赞失败', err)
  }
}

async function handleAddComment() {
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  submitting.value = true
  try {
    await addComment(id, newComment.value.trim())
    ElMessage.success('评论成功')
    newComment.value = ''
    loadComments()
    if (item.value) {
      item.value.commentCount = (item.value.commentCount || 0) + 1
    }
  } catch (err) {
    console.error('评论失败', err)
  } finally {
    submitting.value = false
  }
}

function handleDeleteComment(comment: KnowledgeComment) {
  ElMessageBox.confirm('确定删除这条评论？', '确认删除', { type: 'warning' })
    .then(async () => {
      try {
        await deleteComment(comment.id)
        ElMessage.success('删除成功')
        loadComments()
        if (item.value && item.value.commentCount > 0) {
          item.value.commentCount--
        }
      } catch (err) {
        console.error('删除失败', err)
      }
    })
    .catch(() => {})
}

function handleEdit() {
  router.push(`/knowledge/${id}/edit`)
}

function handleDelete() {
  ElMessageBox.confirm('确定删除这篇文章？删除后无法恢复。', '确认删除', { type: 'warning' })
    .then(async () => {
      try {
        await deleteKnowledge(id)
        ElMessage.success('删除成功')
        router.push('/knowledge')
      } catch (err) {
        console.error('删除失败', err)
      }
    })
    .catch(() => {})
}

function openImagePreview(url: string) {
  previewImage.value = getImageUrl(url)
  previewVisible.value = true
}

function isOwnArticle(): boolean {
  return !!(currentUser.value && item.value && currentUser.value.id === item.value.authorId)
}

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) {
    router.push('/login')
    return
  }
  currentUser.value = getCurrentUser()
  loadData()
  loadComments()
})
</script>

<template>
  <div class="page-container">
    <div class="kb-detail-wrapper" v-loading="loading">
      <div class="kb-back-link">
        <el-button text @click="router.push('/knowledge')">
          <el-icon><ArrowLeft /></el-icon> 返回知识库
        </el-button>
      </div>

      <div v-if="item" class="kb-detail-card">
        <!-- 头部元信息 -->
        <div class="kb-detail-meta">
          <el-tag type="primary">{{ getCategoryLabel(item.category) }}</el-tag>
          <span class="kb-detail-author">
            <el-icon><User /></el-icon>
            {{ item.author }}
          </span>
          <span class="kb-detail-date">创建于 {{ item.createdAt.slice(0, 10) }}</span>
          <span v-if="item.updatedAt !== item.createdAt" class="kb-detail-date">更新于 {{ item.updatedAt.slice(0, 10) }}</span>
        </div>

        <!-- 标题 -->
        <h1 class="kb-detail-title">{{ item.title }}</h1>

        <!-- 标签 -->
        <div class="kb-detail-tags" v-if="item.tags.length > 0">
          <el-tag
            v-for="tag in item.tags"
            :key="tag"
            size="small"
            type="info"
            class="kb-tag"
          >{{ tag }}</el-tag>
        </div>

        <!-- 分隔线 -->
        <div class="kb-divider"></div>

        <!-- 正文内容 -->
        <div class="kb-detail-content">
          <div v-if="item.images && item.images.length > 0" class="kb-content-images">
            <div
              v-for="img in item.images"
              :key="img.id"
              class="kb-image-item"
              @click="openImagePreview(img.url)"
            >
              <img :src="getImageUrl(img.url)" :alt="img.originalName" />
            </div>
          </div>
          <div class="kb-text-content">
            <pre>{{ item.content }}</pre>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="kb-divider"></div>

        <!-- 底部操作栏：点赞 + 编辑删除 -->
        <div class="kb-detail-actions">
          <el-button
            :type="liked ? 'primary' : 'default'"
            :icon="liked ? 'ThumbUpFilled' : 'ThumbUp'"
            @click="handleToggleLike"
          >
            {{ liked ? '已点赞' : '点赞' }} ({{ likeCount }})
          </el-button>
          <div class="kb-actions-right" v-if="isOwnArticle()">
            <el-button @click="handleEdit">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-button type="danger" @click="handleDelete">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>

        <!-- 评论区 -->
        <div class="kb-comments-section">
          <h3 class="kb-comments-title">
            💬 评论 ({{ comments.length }})
          </h3>

          <!-- 发表评论 -->
          <div class="kb-comment-form">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="3"
              placeholder="发表你的看法..."
              :disabled="submitting"
            />
            <div class="kb-comment-form-actions">
              <el-button
                type="primary"
                @click="handleAddComment"
                :loading="submitting"
              >
                发表评论
              </el-button>
            </div>
          </div>

          <!-- 评论列表 -->
          <div class="kb-comments-list" v-loading="loadingComments">
            <div v-for="comment in comments" :key="comment.id" class="kb-comment-item">
              <div class="kb-comment-header">
                <span class="kb-comment-author">{{ comment.author }}</span>
                <span class="kb-comment-date">{{ comment.createdAt.slice(0, 10) }}</span>
                <el-button
                  v-if="currentUser && currentUser.id === comment.authorId"
                  text
                  type="danger"
                  size="small"
                  @click="handleDeleteComment(comment)"
                >
                  删除
                </el-button>
              </div>
              <div class="kb-comment-content">{{ comment.content }}</div>
            </div>

            <div v-if="comments.length === 0 && !loadingComments" class="kb-comments-empty">
              还没有评论，来说两句吧~
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <el-dialog v-model="previewVisible" width="auto" :close-on-click-modal="true">
      <img :src="previewImage" alt="预览" class="kb-preview-image" />
    </el-dialog>
  </div>
</template>

<style scoped>
.kb-detail-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.kb-back-link {
  margin-bottom: 16px;
}

.kb-detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
}

.kb-detail-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.kb-detail-author {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #909399;
}

.kb-detail-date {
  font-size: 14px;
  color: #c0c4cc;
}

.kb-detail-title {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 16px;
  line-height: 1.4;
}

.kb-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}

.kb-tag {
  font-size: 12px;
}

.kb-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 24px 0;
}

.kb-detail-content {
  line-height: 1.8;
}

.kb-content-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.kb-image-item {
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #f5f7fa;
}

.kb-image-item img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  transition: transform 0.2s;
}

.kb-image-item:hover img {
  transform: scale(1.05);
}

.kb-text-content pre {
  margin: 0;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.kb-detail-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kb-actions-right {
  display: flex;
  gap: 8px;
}

.kb-comments-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.kb-comments-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px;
}

.kb-comment-form {
  margin-bottom: 24px;
}

.kb-comment-form-actions {
  margin-top: 12px;
  text-align: right;
}

.kb-comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-comment-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.kb-comment-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.kb-comment-author {
  font-weight: 600;
  color: #409EFF;
  font-size: 14px;
}

.kb-comment-date {
  font-size: 12px;
  color: #c0c4cc;
}

.kb-comment-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
}

.kb-comments-empty {
  text-align: center;
  padding: 40px 0;
  color: #909399;
  font-size: 14px;
}

.kb-preview-image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
}

/* ====== 深色模式 ====== */
html.dark .kb-detail-card {
  background: #1d1e1f;
  box-shadow: 0 1px 8px rgba(0,0,0,0.25);
}

html.dark .kb-detail-title {
  color: #e5eaf3;
}

html.dark .kb-divider {
  background: #363637;
}

html.dark .kb-text-content pre {
  color: #e5eaf3;
}

html.dark .kb-comment-item {
  background: #262727;
}

html.dark .kb-comment-content {
  color: #a3a6ad;
}

html.dark .kb-comments-section {
  border-top-color: #363637;
}

html.dark .kb-comments-title {
  color: #e5eaf3;
}

/* ====== 移动端 ====== */
@media (max-width: 768px) {
  .kb-detail-card {
    padding: 20px 16px;
  }

  .kb-detail-title {
    font-size: 22px;
  }

  .kb-content-images {
    grid-template-columns: 1fr;
  }

  .kb-image-item img {
    height: 200px;
  }

  .kb-text-content pre {
    font-size: 15px;
  }

  .kb-detail-actions {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>