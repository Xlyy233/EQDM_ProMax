<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { hasRole } from '@/stores/user'
import * as api from '@/api/inspection'
import * as equipmentApi from '@/api/equipment'

const loading = ref(false)
const list = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const equipmentTypes = ref<string[]>([])

// 配置设备类型弹窗
const typeDialogVisible = ref(false)
const typeEquipments = ref<any[]>([])
const typeLoading = ref(false)
const typeSaving = ref(false)
const typeEdits = ref<Record<string, string>>({})

const form = ref({
  name: '',
  equipmentType: '',
  items: [{ content: '', order: 0 }] as { content: string; order: number }[]
})

async function loadData() {
  loading.value = true
  try {
    const res = await api.getTemplates()
    list.value = res.data.data?.list || []
  } catch { ElMessage.error('加载模板失败') }
  finally { loading.value = false }
}

async function loadEquipmentTypes() {
  try {
    const res = await equipmentApi.getEquipmentTypes()
    equipmentTypes.value = res.data || []
  } catch { /* ignore */ }
}

function openCreate() {
  isEdit.value = false
  editId.value = ''
  form.value = { name: '', equipmentType: '', items: [{ content: '', order: 0 }] }
  dialogVisible.value = true
}

function openEdit(row: any) {
  isEdit.value = true
  editId.value = row.id
  form.value = {
    name: row.name,
    equipmentType: row.equipmentType,
    items: row.items.map((it: any) => ({ content: it.content, order: it.order }))
  }
  dialogVisible.value = true
}

function addItem() {
  form.value.items.push({ content: '', order: form.value.items.length })
}

function removeItem(index: number) {
  if (form.value.items.length <= 1) return
  form.value.items.splice(index, 1)
}

async function handleSubmit() {
  if (!form.value.name.trim() || !form.value.equipmentType.trim()) {
    ElMessage.warning('请填写模板名称和设备类型')
    return
  }
  const validItems = form.value.items.filter(it => it.content.trim())
  if (validItems.length === 0) {
    ElMessage.warning('请至少添加一个巡检项目')
    return
  }
  submitting.value = true
  try {
    const data = {
      name: form.value.name.trim(),
      equipmentType: form.value.equipmentType.trim(),
      items: validItems.map((it, i) => ({ content: it.content.trim(), order: i }))
    }
    if (isEdit.value) {
      await api.updateTemplate(editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await api.createTemplate(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
    loadEquipmentTypes()
  } catch { ElMessage.error('操作失败') }
  finally { submitting.value = false }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除模板"${row.name}"？`, '确认删除', { type: 'warning' })
    await api.deleteTemplate(row.id)
    ElMessage.success('删除成功')
    loadData()
    loadEquipmentTypes()
  } catch { /* cancelled */ }
}

// 配置设备类型
async function openTypeConfig() {
  typeDialogVisible.value = true
  typeLoading.value = true
  typeEdits.value = {}
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    typeEquipments.value = res.data?.list || []
  } catch { ElMessage.error('加载设备列表失败') }
  finally { typeLoading.value = false }
}

function onTypeEditChange(eqId: string, val: string) {
  typeEdits.value = { ...typeEdits.value, [eqId]: val }
}

async function saveTypeConfig() {
  const updates = Object.entries(typeEdits.value)
    .filter(([id, type]) => type !== undefined)
    .map(([id, type]) => ({ id, type }))
  if (updates.length === 0) {
    ElMessage.warning('没有需要保存的修改')
    return
  }
  typeSaving.value = true
  try {
    await equipmentApi.batchUpdateTypes(updates)
    ElMessage.success('设备类型配置已保存')
    typeDialogVisible.value = false
    loadEquipmentTypes()
  } catch { ElMessage.error('保存失败') }
  finally { typeSaving.value = false }
}

onMounted(() => {
  if (!hasRole(['manager', 'admin'])) {
    ElMessage.error('没有权限访问')
    return
  }
  loadData()
  loadEquipmentTypes()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">巡检模板</h2>
      <div style="display:flex;gap:8px;">
        <el-button size="small" @click="openTypeConfig">配置设备类型</el-button>
        <el-button type="primary" size="small" @click="openCreate">新建模板</el-button>
      </div>
    </div>

    <div class="stat-card" style="margin:0 24px;" v-loading="loading">
      <el-table :data="list" stripe size="small" v-if="list.length > 0">
        <el-table-column prop="name" label="模板名称" min-width="150" />
        <el-table-column prop="equipmentType" label="设备类型" width="120" />
        <el-table-column label="巡检项目数" width="100" align="center">
          <template #default="{ row }">{{ row.items?.length || 0 }}</template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建人" width="100" />
        <el-table-column prop="updatedAt" label="更新时间" width="140" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无巡检模板" :image-size="80" />
    </div>

    <!-- 创建/编辑弹窗 -->
    <el-dialog
      :title="isEdit ? '编辑模板' : '新建模板'"
      v-model="dialogVisible"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!submitting"
    >
      <el-form label-width="80px" :disabled="submitting">
        <el-form-item label="模板名称">
          <el-input v-model="form.name" placeholder="如：注塑机日常巡检" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="form.equipmentType" placeholder="选择设备类型" filterable allow-create style="width:100%">
            <el-option v-for="t in equipmentTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="巡检项目">
          <div style="width:100%">
            <div v-for="(item, index) in form.items" :key="index" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
              <span style="flex-shrink:0;color:#909399;font-size:13px;">{{ index + 1 }}.</span>
              <el-input v-model="item.content" placeholder="巡检项目内容" size="small" />
              <el-button type="danger" :icon="'Delete'" circle size="small" @click="removeItem(index)" :disabled="form.items.length <= 1" />
            </div>
            <el-button type="primary" link size="small" @click="addItem">+ 添加项目</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 配置设备类型弹窗 -->
    <el-dialog
      title="配置设备类型"
      v-model="typeDialogVisible"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div v-loading="typeLoading">
        <el-table :data="typeEquipments" stripe size="small" max-height="400">
          <el-table-column prop="code" label="设备编号" width="120" />
          <el-table-column prop="name" label="设备名称" min-width="120" />
          <el-table-column label="设备类型" width="160">
            <template #default="{ row }">
              <el-input
                :model-value="typeEdits[row.id] !== undefined ? typeEdits[row.id] : row.type || ''"
                @update:model-value="onTypeEditChange(row.id, $event)"
                placeholder="输入设备类型"
                size="small"
              />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!typeLoading && typeEquipments.length === 0" description="暂无设备" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTypeConfig" :loading="typeSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .el-dialog { width: 95% !important; }
}
</style>