<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { canManageEquipment } from '@/stores/user'
import { statusMap } from '@/types'
import type { Equipment, EquipmentStatus } from '@/types'
import * as equipmentApi from '@/api/equipment'

const route = useRoute()
const router = useRouter()
const equipment = ref<Equipment | null>(null)
const loading = ref(true)
const submitting = ref(false)

const form = ref<{ status: EquipmentStatus }>({ status: 'in_use' })

function loadData() {
  loading.value = true
  equipmentApi.getEquipmentById(route.params.id as string).then(res => {
    equipment.value = res.data
    form.value.status = res.data?.status || 'in_use'
  }).catch(() => {}).finally(() => { loading.value = false })
}

async function handleSave() {
  if (!equipment.value) return
  submitting.value = true
  try {
    await equipmentApi.updateEquipment(equipment.value.id, { status: form.value.status })
    ElMessage.success('保存修改成功')
    loadData()
  } catch (e) {
  } finally {
    submitting.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">编辑设备</h2>
      </div>
    </div>

    <div class="stat-card" style="padding:24px;max-width:800px;" v-loading="loading">
      <el-form :model="form" label-width="100px" v-if="equipment">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="设备编号">
              <el-input v-model="equipment.code" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="设备名称">
              <el-input v-model="equipment.name" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="规格型号">
              <el-input :model-value="equipment.model || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="品牌">
              <el-input :model-value="equipment.brand || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="所属部门">
              <el-input v-model="equipment.department" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="安装位置">
              <el-input :model-value="equipment.location || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
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
            <el-form-item label="关键设备">
              <el-input :model-value="equipment.keyEquipment || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="产线编码">
              <el-input :model-value="equipment.productionLineCode || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="出厂编号">
              <el-input :model-value="equipment.factoryCode || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="资产类型">
              <el-input :model-value="equipment.assetType || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="数量">
              <el-input :model-value="equipment.quantity || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="额定功率">
              <el-input :model-value="equipment.ratedPower || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="使用位置">
              <el-input :model-value="equipment.useLocation || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="启用日期">
              <el-input :model-value="equipment.enableDate || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="出厂日期">
              <el-input :model-value="equipment.factoryDate || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="采购日期">
              <el-input :model-value="equipment.purchaseDate || ''" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item v-if="canManageEquipment()">
          <el-button type="primary" :loading="submitting" @click="handleSave">保存修改</el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>

      <div v-if="!equipment" style="text-align:center;padding:40px;color:#909399;">
        设备不存在或已被删除
      </div>
    </div>
  </div>
</template>
