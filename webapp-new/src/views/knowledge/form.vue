<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCurrentUser, loadFromStorage, isLoggedIn } from '@/stores/user'
import {
  createKnowledge,
  updateKnowledge,
  getKnowledgeDetail,
  uploadKnowledgeImages,
  type KnowledgeImage,
  getImageUrl
} from '@/api/knowledge'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!(route.params.id && route.path.includes('/edit')))
const editId = computed(() => (route.params.id as string) || '')

const loading = ref(false)
const submitting = ref(false)
const uploading = ref(false)

const categories = [
  { id: 'tech', label: '技术分享' },
  { id: 'workflow', label: '工作流程' },
  { id: 'tools', label: '工具技巧' },
  { id: 'bestpractice', label: '最佳实践' },
]

const form = ref({
  title: '',
  content: '',
  summary: '',
  category: 'tech',
  tags: ''
})

const images = ref<KnowledgeImage[]>([])
const coverImageId = ref('')

function resetForm() {
  form.value = { title: '', content: '', summary: '', category: 'tech', tags: '' }
  images.value = []
  coverImageId.value = ''
  loading.value = false
  submitting.value = false
}

function handleCancel() {
  router.push('/knowledge')
}

async function handleUploadImages() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = async () => {
    const files = Array.from(input.files || [])
    if (files.length === 0) return
    if (files.length > 10) {
      ElMessage.warning('最多上传10张图片')
      return
    }
    uploading.value = true
    try {
      const res = await uploadKnowledgeImages(files)
      images.value.push(...res.data)
      if (images.value.length === 1) {
        coverImageId.value = images.value[0].id
      }
      ElMessage.success(`成功上传 ${res.data.length} 张图片`)
    } catch (err) {
      console.error('上传失败', err)
    } finally {
      uploading.value = false
    }
  }
  input.click()
}

function removeImage(img: KnowledgeImage) {
  images.value = images.value.filter(i => i.id !== img.id)
  if (coverImageId.value === img.id) {
    coverImageId.value = images.value.length > 0 ? images.value[0].id : ''
  }
}

function setCoverImage(img: KnowledgeImage) {
  coverImageId.value = img.id
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!form.value.content.trim()) {
    ElMessage.warning('请填写内容')
    return
  }

  submitting.value = true
  try {
    const tags = form.value.tags.split(',').map(t => t.trim()).filter(Boolean)
    const imageIds = images.value.map(img => img.id)
    const data = {
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      summary: form.value.summary.trim() || form.value.content.trim().slice(0, 150),
      category: form.value.category,
      tags,
      coverImageId: coverImageId.value,
      imageIds
    }

    if (isEdit.value) {
      await updateKnowledge(editId.value, data)
      ElMessage.success('更新成功')
      router.push(`/knowledge/${editId.value}`)
    } else {
      const res = await createKnowledge(data)
      ElMessage.success('发布成功')
      router.push(`/knowledge/${res.data.id}`)
    }
  } catch (err) {
    console.error('提交失败', err)
  } finally {
    submitting.value = false
  }
}

async function loadEditData() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const item = await getKnowledgeDetail(editId.value)
    form.value = {
      title: item.title,
      content: item.content,
      summary: item.summary || '',
      category: item.category,
      tags: item.tags.join(', ')
    }
    images.value = item.images || []
    coverImageId.value = item.coverImageId || ''
  } catch (err) {
    console.error('加载失败', err)
    ElMessage.error('文章不存在')
    router.push('/knowledge')
  } finally {
    loading.value = false
  }
}

// 路由变化时重新初始化表单
watch(() => route.fullPath, () => {
  resetForm()
  loadEditData()
})

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) {
    router.push('/login')
    return
  }
  loadEditData()
})
</script>

<template>
  <div class="page-container">
    <div class="kb-form-wrapper" v-loading="loading">
      <div class="kb-form-header">
        <el-button @click="handleCancel" text>
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <h2 class="kb-form-title">{{ isEdit ? '编辑知识' : '发布知识' }}</h2>
        <div></div>
      </div>

      <div class="kb-form-card">
        <el-form label-width="60px">
          <el-form-item label="标题" required>
            <el-input
              v-model="form.title"
              placeholder="请输入知识标题"
              size="large"
            />
          </el-form-item>

          <el-form-item label="摘要">
            <el-input
              v-model="form.summary"
              type="textarea"
              :rows="2"
              placeholder="简要描述（不填则自动截取正文前150字）"
            />
          </el-form-item>

          <el-form-item label="分类">
            <el-select v-model="form.category" style="width:100%;">
              <el-option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
                :label="cat.label"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="标签">
            <el-input
              v-model="form.tags"
              placeholder="多个标签用逗号分隔，如：设备维护,常见问题"
            />
          </el-form-item>

          <el-form-item label="图片">
            <div class="kb-image-upload-area">
              <div class="kb-image-grid">
                <div
                  v-for="img in images"
                  :key="img.id"
                  class="kb-image-thumb"
                  :class="{ cover: img.id === coverImageId }"
                >
                  <img :src="getImageUrl(img.url)" :alt="img.originalName" />
                  <div class="kb-image-mask">
                    <el-button
                      v-if="img.id !== coverImageId"
                      size="small"
                      type="primary"
                      @click="setCoverImage(img)"
                    >设为封面</el-button>
                    <el-tag v-else size="small" type="success">封面</el-tag>
                    <el-button size="small" type="danger" @click="removeImage(img)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>

                <div
                  class="kb-image-upload-btn"
                  v-if="images.length < 10"
                  @click="handleUploadImages"
                  :class="{ uploading }"
                >
                  <el-icon :size="32"><Plus /></el-icon>
                  <span>上传图片</span>
                </div>
              </div>
              <div class="kb-image-hint" v-if="images.length > 0">
                已上传 {{ images.length }} 张图片，点击图片可设为封面
              </div>
            </div>
          </el-form-item>

          <el-form-item label="正文" required>
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="14"
              placeholder="请详细描述您要分享的知识内容..."
            />
          </el-form-item>
        </el-form>

        <div class="kb-form-footer">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存修改' : '发布知识' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kb-form-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.kb-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.kb-form-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.kb-form-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
}

.kb-image-upload-area {
  width: 100%;
}

.kb-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.kb-image-thumb {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 3px solid transparent;
  background: #f5f7fa;
}

.kb-image-thumb.cover {
  border-color: #409EFF;
}

.kb-image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.kb-image-mask {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.kb-image-thumb:hover .kb-image-mask {
  opacity: 1;
}

.kb-image-upload-btn {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  border: 2px dashed #dcdfe6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.kb-image-upload-btn:hover {
  border-color: #409EFF;
  color: #409EFF;
}

.kb-image-upload-btn.uploading {
  opacity: 0.5;
  pointer-events: none;
}

.kb-image-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.kb-form-footer {
  margin-top: 24px;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* ====== 深色模式 ====== */
html.dark .kb-form-card {
  background: #1d1e1f;
  box-shadow: 0 1px 8px rgba(0,0,0,0.25);
}

html.dark .kb-form-title {
  color: #e5eaf3;
}

html.dark .kb-image-upload-btn {
  border-color: #4c4d4f;
  color: #6b6e75;
}

html.dark .kb-image-upload-btn:hover {
  border-color: #409EFF;
  color: #409EFF;
}

html.dark .kb-image-thumb {
  background: #262727;
}

/* ====== 移动端 ====== */
@media (max-width: 768px) {
  .kb-form-card {
    padding: 20px 16px;
  }

  .kb-image-thumb,
  .kb-image-upload-btn {
    width: 100px;
    height: 100px;
  }
}
</style>