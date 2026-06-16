<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import type { MaintenancePlan, Equipment, User } from '@/types'
import { cycleTypeMap, maintenanceStatusMap } from '@/types'
import * as maintenanceApi from '@/api/maintenance'
import * as equipmentApi from '@/api/equipment'
import * as userApi from '@/api/user'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => route.name === 'MaintenanceEdit')
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitting = ref(false)

const equipments = ref<Equipment[]>([])
const users = ref<User[]>([])

const form = ref({
  equipmentId: '',
  planName: '',
  cycleType: 'monthly' as string,
  cycleValue: 1,
  lastMaintenanceDate: '',
  nextMaintenanceDate: '',
  responsibleUserId: '',
  status: 'active' as string,
  remark: ''
})

const rules = {
  equipmentId: [{ required: true, message: '请选择设备', trigger: 'change' }],
  planName: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
  nextMaintenanceDate: [{ required: true, message: '请选择下次保养日期', trigger: 'change' }]
}

const cycleTypeOptions = Object.entries(cycleTypeMap).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(maintenanceStatusMap).map(([value, label]) => ({ value, label }))

async function loadEquipments() {
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    equipments.value = res.data?.list || []
  } catch {}
}

async function loadUsers() {
  try {
    const res = await userApi.getUsers({ pageSize: 999 })
    users.value = res.data?.list || []
  } catch {}
}

async function loadData() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await maintenanceApi.getPlanById(route.params.id as string)
    if (res.data) {
      form.value = {
        equipmentId: res.data.equipmentId,
        planName: res.data.planName,
        cycleType: res.data.cycleType,
        cycleValue: res.data.cycleValue,
        lastMaintenanceDate: res.data.lastMaintenanceDate || '',
        nextMaintenanceDate: res.data.nextMaintenanceDate || '',
        responsibleUserId: res.data.responsibleUserId || '',
        status: res.data.status,
        remark: res.data.remark || ''
      }
    }
  } catch {} finally { loading.value = false }
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const eq = equipments.value.find(e => e.id === form.value.equipmentId)
    const user = users.value.find(u => u.id === form.value.responsibleUserId)
    const payload = {
      ...form.value,
      equipmentName: eq?.name || '',
      equipmentCode: eq?.code || '',
      responsibleUserName: user?.realName || user?.username || ''
    }
    if (isEdit.value) {
      await maintenanceApi.updatePlan(route.params.id as string, payload)
      ElMessage.success('更新成功')
    } else {
      await maintenanceApi.addPlan(payload)
      ElMessage.success('新增成功')
    }
    router.replace('/maintenance')
  } catch {} finally { submitting.value = false }
}

onMounted(async () => {
  await Promise.all([loadEquipments(), loadUsers()])
  loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">{{ isEdit ? '编辑保养计划' : '新增保养计划' }}</h2>
      </div>
    </div>

    <div class="form-wrapper" v-loading="loading">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" :disabled="submitting">

        <div class="section-card">
          <div class="section-title">基本信息</div>

          <el-form-item label="关联设备" prop="equipmentId">
            <el-select v-model="form.equipmentId" filterable placeholder="搜索并选择设备" style="width:100%;">
              <el-option
                v-for="eq in equipments"
                :key="eq.id"
                :value="eq.id"
                :label="`${eq.code} ${eq.name}`"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="计划名称" prop="planName">
            <el-input v-model="form.planName" placeholder="请输入计划名称" />
          </el-form-item>

          <el-form-item label="负责人">
            <el-select v-model="form.responsibleUserId" filterable placeholder="选择负责人" style="width:100%;" clearable>
              <el-option
                v-for="u in users"
                :key="u.id"
                :value="u.id"
                :label="`${u.realName || u.username}`"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="计划状态">
            <el-select v-model="form.status" style="width:100%;">
              <el-option
                v-for="opt in statusOptions"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="section-card">
          <div class="section-title">周期设置</div>

          <el-form-item label="保养周期">
            <div style="display:flex;gap:12px;width:100%;">
              <el-select v-model="form.cycleType" style="flex:1;">
                <el-option v-for="opt in cycleTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
              </el-select>
              <el-input-number v-model="form.cycleValue" :min="1" :max="365" style="flex:1;" />
            </div>
          </el-form-item>

          <el-form-item label="上次保养日期">
            <el-date-picker
              v-model="form.lastMaintenanceDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width:100%;"
            />
          </el-form-item>

          <el-form-item label="下次保养日期" prop="nextMaintenanceDate">
            <el-date-picker
              v-model="form.nextMaintenanceDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width:100%;"
            />
          </el-form-item>
        </div>

        <div class="section-card">
          <div class="section-title">备注</div>
          <el-form-item label="备注" label-width="80px">
            <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="备注（选填）..." />
          </el-form-item>
        </div>

        <div class="submit-row">
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '确认新增' }}
          </el-button>
          <el-button size="large" @click="router.back()">取消</el-button>
        </div>

      </el-form>
    </div>
  </div>
</template>

<style scoped>
.form-wrapper {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}

.section-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 20px 4px;
  margin-bottom: 16px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background: #409EFF;
  border-radius: 2px;
}

.submit-row {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding: 20px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

@media (max-width: 768px) {
  .form-wrapper {
    padding: 12px 12px 32px;
  }

  .section-card {
    padding: 16px 14px 2px;
    margin-bottom: 12px;
    border-radius: 8px;
  }

  .submit-row {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .submit-row :deep(.el-button) {
    width: 100%;
  }
}
</style>