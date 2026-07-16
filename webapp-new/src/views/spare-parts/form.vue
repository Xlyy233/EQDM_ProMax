<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { isLoggedIn } from '@/stores/user'
import type { SparePart, Equipment } from '@/types'
import * as api from '@/api/sparePart'
import * as equipmentApi from '@/api/equipment'

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const loading = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const equipments = ref<Equipment[]>([])

const form = ref({
  id: '',
  name: '',
  spec: '',
  quantity: 0,
  minStock: 0,
  unit: '个',
  location: '',
  equipmentId: '',
  equipmentName: '',
  remark: ''
})

async function loadEquipments() {
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    equipments.value = res.data?.list || []
  } catch { /* ignore */ }
}

function onEquipmentChange(val: string) {
  const eq = equipments.value.find(e => e.id === val)
  form.value.equipmentName = eq ? eq.name : ''
}

async function loadData() {
  const id = route.query.id as string
  if (!id) return
  isEdit.value = true
  loading.value = true
  try {
    const res = await api.getSparePart(id)
    const data = res.data
    if (data) {
      form.value = {
        id: data.id,
        name: data.name,
        spec: data.spec,
        quantity: data.quantity,
        minStock: data.minStock,
        unit: data.unit || '个',
        location: data.location,
        equipmentId: data.equipmentId,
        equipmentName: data.equipmentName,
        remark: data.remark
      }
    }
  } catch { ElMessage.error('加载备件信息失败') }
  finally { loading.value = false }
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  if (!form.value.name.trim()) { ElMessage.warning('请输入备件名称'); return }

  submitting.value = true
  try {
    if (isEdit.value) {
      await api.updateSparePart(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await api.createSparePart(form.value)
      ElMessage.success('新增成功')
    }
    router.replace('/spare-parts/list')
  } catch { ElMessage.error('提交失败') }
  finally { submitting.value = false }
}

onMounted(() => {
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadEquipments()
  loadData()
})
</script>

<template>
  <div class="sp-form-container">
    <div class="sp-form-header">
      <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
      <h2>{{ isEdit ? '编辑备件' : '新增备件' }}</h2>
    </div>

    <div class="sp-form-card" v-loading="loading">
      <el-form ref="formRef" :model="form" label-width="100px" label-position="top" @submit.prevent>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="备件名称" prop="name" :rules="[{ required: true, message: '请输入备件名称' }]">
              <el-input v-model="form.name" placeholder="如：轴承 6205-2RS" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="规格型号">
              <el-input v-model="form.spec" placeholder="如：6205-2RS / SKF" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <el-form-item label="库存数量" prop="quantity" :rules="[{ required: true, message: '请输入库存数量' }]">
              <el-input-number v-model="form.quantity" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="最低库存" prop="minStock" :rules="[{ required: true, message: '请输入最低库存' }]">
              <el-input-number v-model="form.minStock" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="单位">
              <el-select v-model="form.unit" style="width:100%">
                <el-option label="个" value="个" />
                <el-option label="套" value="套" />
                <el-option label="根" value="根" />
                <el-option label="米" value="米" />
                <el-option label="升" value="升" />
                <el-option label="公斤" value="公斤" />
                <el-option label="件" value="件" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-form-item label="存放位置">
              <el-input v-model="form.location" placeholder="如：A区货架3层" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="关联设备">
              <el-select v-model="form.equipmentId" placeholder="选择设备（可选）" clearable filterable style="width:100%"
                @change="onEquipmentChange">
                <el-option v-for="eq in equipments" :key="eq.id" :label="eq.code + ' ' + eq.name" :value="eq.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注信息（可选）" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit" style="width:200px;">
            {{ isEdit ? '保存修改' : '确认新增' }}
          </el-button>
          <el-button size="large" @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.sp-form-container { padding: 20px 24px; max-width: 900px; }
.sp-form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.sp-form-header h2 { margin: 0; font-size: 18px; color: #303133; }
.sp-form-card { background: #fff; border-radius: 12px; padding: 24px; }

@media (max-width: 768px) {
  .sp-form-container { padding: 12px; }
  .sp-form-card { padding: 16px; }
}
</style>