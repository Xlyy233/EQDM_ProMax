<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { RecordType } from '@/types'
import type { Template } from '@/data/recordTemplates'
import {
  getUserTemplates,
  addUserTemplate,
  updateUserTemplate,
  deleteUserTemplate,
  getRecordTypeOptions
} from '@/data/recordTemplates'

const router = useRouter()
const recordTypes = getRecordTypeOptions()
const currentType = ref<RecordType | ''>('')
const showModal = ref(false)
const editingTemplate = ref<Template | null>(null)
const templates = ref<Template[]>([])

const formData = ref({
  name: '',
  type: 'repair' as RecordType,
  description: '',
  reason: '',
  method: ''
})

const filteredTemplates = computed(() => {
  if (!currentType.value) return templates.value
  return templates.value.filter(t => t.type === currentType.value)
})

function getTypeName(type: string) {
  return recordTypes.find(t => t.value === type)?.label || type
}

function loadTemplates() {
  templates.value = getUserTemplates()
}

function openAddModal() {
  editingTemplate.value = null
  formData.value = { name: '', type: 'repair' as RecordType, description: '', reason: '', method: '' }
  showModal.value = true
}

function openEditModal(tpl: Template) {
  editingTemplate.value = tpl
  formData.value = {
    name: tpl.name,
    type: tpl.type,
    description: tpl.description,
    reason: tpl.reason,
    method: tpl.method
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingTemplate.value = null
}

function handleSave() {
  if (!formData.value.name.trim()) { ElMessage.warning('请输入模板名称'); return }
  if (!formData.value.description.trim()) { ElMessage.warning('请输入描述'); return }
  if (!formData.value.reason.trim()) { ElMessage.warning('请输入原因'); return }
  if (!formData.value.method.trim()) { ElMessage.warning('请输入方法'); return }

  if (templates.value.length >= 99 && !editingTemplate.value) {
    ElMessage.warning('模板数量已达上限（99条）')
    return
  }

  if (editingTemplate.value) {
    updateUserTemplate(editingTemplate.value.id, formData.value)
    ElMessage.success('修改成功')
  } else {
    addUserTemplate(formData.value)
    ElMessage.success('添加成功')
  }
  loadTemplates()
  closeModal()
}

function handleDelete(id: string) {
  ElMessageBox.confirm('确定要删除这个模板吗？', '确认', { type: 'warning' }).then(() => {
    deleteUserTemplate(id)
    loadTemplates()
    ElMessage.success('删除成功')
  }).catch(() => {})
}

onMounted(loadTemplates)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">常用模板</h2>
      </div>
      <el-tooltip content="添加模板">
        <el-button type="primary" circle @click="openAddModal"><el-icon><Plus /></el-icon></el-button>
      </el-tooltip>
    </div>

    <!-- 类型标签 -->
    <div class="type-tabs">
      <el-tag
        :type="currentType === '' ? 'success' : 'info'"
        effect="plain"
        class="type-tag"
        @click="currentType = ''"
      >全部</el-tag>
      <el-tag
        v-for="t in recordTypes"
        :key="t.value"
        :type="currentType === t.value ? 'success' : 'info'"
        effect="plain"
        class="type-tag"
        @click="currentType = t.value as RecordType"
      >{{ t.label }}</el-tag>
    </div>

    <!-- 模板列表 -->
    <div class="template-list" v-if="filteredTemplates.length > 0">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="template-item"
        @click="openEditModal(tpl)"
      >
        <div class="tpl-header">
          <span class="tpl-name">{{ tpl.name }}</span>
          <el-tag size="small" :type="tpl.type === 'repair' ? 'danger' : tpl.type === 'maintenance' ? 'primary' : tpl.type === 'inspection' ? 'success' : 'warning'">
            {{ getTypeName(tpl.type) }}
          </el-tag>
        </div>
        <div class="tpl-body">
          <div class="tpl-field"><span class="field-label">描述：</span>{{ tpl.description }}</div>
          <div class="tpl-field"><span class="field-label">原因：</span>{{ tpl.reason }}</div>
          <div class="tpl-field"><span class="field-label">方法：</span>{{ tpl.method }}</div>
        </div>
        <div class="tpl-footer">
          <span class="tpl-time">使用次数：{{ tpl.frequency || 0 }}</span>
          <span class="tpl-time">创建时间：{{ tpl.createdAt }}</span>
          <el-button link type="danger" size="small" @click.stop="handleDelete(tpl.id)">删除</el-button>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无模板，点击右上角添加" />

    <div class="footer-tip">当前共 {{ templates.length }} 条模板，最多支持99条</div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="showModal"
      :title="editingTemplate ? '编辑模板' : '添加模板'"
      width="500px"
      :close-on-click-modal="false"
      destroy-on-close
      class="template-dialog"
    >
      <el-form :model="formData" label-width="80px" @submit.prevent="handleSave">
        <el-form-item label="工作类型" required>
          <el-radio-group v-model="formData.type">
            <el-radio v-for="t in recordTypes" :key="t.value" :value="t.value as RecordType">{{ t.label }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="模板名称" required>
          <el-input v-model="formData.name" placeholder="输入模板名称" maxlength="50" />
        </el-form-item>

        <el-form-item label="描述" required>
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="输入描述" maxlength="500" />
        </el-form-item>

        <el-form-item label="原因" required>
          <el-input v-model="formData.reason" type="textarea" :rows="3" placeholder="输入原因" maxlength="500" />
        </el-form-item>

        <el-form-item label="方法" required>
          <el-input v-model="formData.method" type="textarea" :rows="3" placeholder="输入解决方法" maxlength="500" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.type-tabs {
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  background: #fff;
  border-radius: 8px;
  margin: 16px 24px;
}

.type-tag {
  cursor: pointer;
  user-select: none;
  padding: 6px 16px;
  font-size: 14px;
}

.template-list {
  padding: 0 24px;
  margin-bottom: 16px;
}

.template-item {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s;
  border: 1px solid #ebeef5;
}

.template-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tpl-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.tpl-body {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.tpl-field {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
}

.field-label {
  color: #909399;
  font-weight: 500;
}

.tpl-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tpl-time {
  font-size: 12px;
  color: #999;
}

.footer-tip {
  text-align: center;
  padding: 16px;
  font-size: 13px;
  color: #999;
}

@media (max-width: 768px) {
  .type-tabs {
    margin: 12px;
    padding: 10px;
  }

  .template-list {
    padding: 0 12px;
  }

  .template-item {
    padding: 14px;
  }

  .tpl-name {
    font-size: 15px;
  }

  .template-dialog :deep(.el-dialog) {
    width: 90% !important;
    margin: 10vh auto !important;
  }
}
</style>