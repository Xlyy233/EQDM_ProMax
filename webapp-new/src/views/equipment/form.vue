<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import * as equipmentApi from '@/api/equipment'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => route.name === 'EquipmentEdit')
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitting = ref(false)

const form = ref({
  code: '', name: '', model: '', purchaseDate: '', department: '',
  location: '', status: 'in_use' as string, qrcode: '',
  keyEquipment: '', productionLineCode: '', factoryCode: '', assetType: '',
  assetStatus: '', brand: '', quantity: '', enableDate: '', factoryDate: '',
  ratedPower: '', useLocation: '', departmentName: ''
})

const rules = {
  code: [{ required: true, message: '请输入设备编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  department: [{ required: true, message: '请输入所属部门', trigger: 'blur' }],
}

async function loadData() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await equipmentApi.getEquipmentById(route.params.id as string)
    if (res.data) {
      form.value = { ...form.value, ...res.data }
    }
  } catch (e) {} finally { loading.value = false }
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (isEdit.value) {
      await equipmentApi.updateEquipment(route.params.id as string, form.value)
      ElMessage.success('更新成功')
    } else {
      await equipmentApi.addEquipment(form.value as any)
      ElMessage.success('添加成功')
    }
    router.replace('/equipment')
  } catch (e) {} finally { submitting.value = false }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">{{ isEdit ? '编辑设备' : '新增设备' }}</h2>
      </div>
    </div>

    <div class="stat-card" style="padding:24px;max-width:800px;" v-loading="loading">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="submitting">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="设备编号" prop="code"><el-input v-model="form.code" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="设备名称" prop="name"><el-input v-model="form.name" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="规格型号"><el-input v-model="form.model" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="所属部门" prop="department"><el-input v-model="form.department" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="安装位置"><el-input v-model="form.location" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="设备状态">
              <el-select v-model="form.status" style="width:100%;">
                <el-option label="在用" value="in_use" />
                <el-option label="停用" value="stopped" />
                <el-option label="报废" value="scrapped" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="关键设备"><el-input v-model="form.keyEquipment" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="产线编码"><el-input v-model="form.productionLineCode" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="出厂编号"><el-input v-model="form.factoryCode" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="资产类型"><el-input v-model="form.assetType" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="数量"><el-input v-model="form.quantity" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="额定功率"><el-input v-model="form.ratedPower" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="使用位置"><el-input v-model="form.useLocation" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="启用日期"><el-date-picker v-model="form.enableDate" type="date" style="width:100%;" placeholder="选择日期" value-format="YYYY-MM-DD" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="出厂日期"><el-date-picker v-model="form.factoryDate" type="date" style="width:100%;" placeholder="选择日期" value-format="YYYY-MM-DD" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="采购日期"><el-date-picker v-model="form.purchaseDate" type="date" style="width:100%;" placeholder="选择日期" value-format="YYYY-MM-DD" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存修改' : '确认添加' }}</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>