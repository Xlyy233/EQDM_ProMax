<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getCurrentUser } from '@/stores/user'
import type { WorkRecord, Equipment, RecordType } from '@/types'
import * as recordApi from '@/api/record'
import * as equipmentApi from '@/api/equipment'
import dayjs from 'dayjs'
import {
  getTemplatesByType,
  updateTemplateFrequency,
  saveRecentEquipment,
  generateAutoTitle,
  formatTemplateContent,
  getRecordTypeOptions,
  getProcessResultOptions
} from '@/data/recordTemplates'
import type { Template } from '@/data/recordTemplates'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => route.name === 'RecordEdit')
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitting = ref(false)

const equipments = ref<Equipment[]>([])
const currentEquipment = ref<Equipment | null>(null)
const lastRecord = ref<WorkRecord | null>(null)

const form = ref({
  equipmentId: '',
  equipmentName: '',
  type: 'repair' as RecordType,
  title: '',
  content: '',
  startTime: '',
  endTime: '',
  result: 'fixed' as string,
  remark: '',
  personnel: '',
  isStopped: 'no' as 'yes' | 'no',
  stopDuration: '',
  stopDurationUnit: 'minutes' as 'minutes' | 'hours',
  photos: [] as string[]
})

const rules = {
  equipmentId: [{ required: true, message: '请选择设备', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }]
}

// ========== 常用模板 ==========
const filteredTemplates = computed(() => {
  return getTemplatesByType(form.value.type)
})

function applyTemplate(tpl: Template) {
  form.value.content = formatTemplateContent(tpl)
  form.value.result = tpl.method
  updateTemplateFrequency(tpl.id)
  ElMessage.success(`已应用模板「${tpl.name}」`)
}

// ========== 自动生成标题 ==========
function autoGenerateTitle() {
  if (!form.value.equipmentName) return
  form.value.title = generateAutoTitle(form.value.equipmentName, form.value.type)
}

function onRecordTypeChange() {
  autoGenerateTitle()
}

function onEquipmentChange(val: string) {
  const eq = equipments.value.find(e => e.id === val)
  if (eq) {
    form.value.equipmentId = eq.id
    form.value.equipmentName = eq.name
    saveRecentEquipment({ id: eq.id, code: eq.code, name: eq.name })
    autoGenerateTitle()
    loadLastRecord(eq.id)
  }
}

async function loadEquipments() {
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    const allList = res.data?.list || []
    equipments.value = allList.filter(eq => eq.status !== 'scrapped')

    if (isEdit.value && currentEquipment.value && currentEquipment.value.status === 'scrapped') {
      const exists = equipments.value.some(eq => eq.id === currentEquipment.value!.id)
      if (!exists) equipments.value.unshift(currentEquipment.value)
    }

    const equipmentId = route.query.equipmentId as string
    const equipmentName = route.query.equipmentName as string
    if (!isEdit.value && equipmentId) {
      const eq = equipments.value.find(e => e.id === equipmentId)
      if (eq) {
        form.value.equipmentId = equipmentId
        form.value.equipmentName = eq.name
        saveRecentEquipment({ id: eq.id, code: eq.code, name: eq.name })
        autoGenerateTitle()
        loadLastRecord(eq.id)
      } else if (equipmentName) {
        const scrappedEq = allList.find(e => e.id === equipmentId)
        if (scrappedEq) {
          equipments.value.unshift(scrappedEq)
          form.value.equipmentId = equipmentId
          form.value.equipmentName = scrappedEq.name
        }
      }
    }
  } catch (e) {}
}

async function loadLastRecord(equipmentId: string) {
  try {
    const res = await recordApi.getRecords({ equipmentId, page: 1, pageSize: 1 })
    if (res.data?.list && res.data.list.length > 0) {
      lastRecord.value = res.data.list[0]
    } else {
      lastRecord.value = null
    }
  } catch {
    lastRecord.value = null
  }
}

async function loadData() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await recordApi.getRecordById(route.params.id as string)
    if (res.data) {
      form.value = {
        equipmentId: res.data.equipmentId,
        equipmentName: res.data.equipmentName,
        type: res.data.type,
        title: res.data.title,
        content: res.data.content,
        startTime: res.data.startTime,
        endTime: res.data.endTime,
        result: res.data.result || 'fixed',
        remark: res.data.remark,
        personnel: res.data.personnel,
        isStopped: res.data.isStopped || 'no',
        stopDuration: res.data.stopDuration || '',
        stopDurationUnit: res.data.stopDurationUnit || 'minutes',
        photos: Array.isArray(res.data.photos) ? res.data.photos : (typeof res.data.photos === 'string' ? (() => { try { return JSON.parse(res.data.photos) } catch { return [] } })() : [])
      }
      try {
        const eqRes = await equipmentApi.getEquipmentById(res.data.equipmentId)
        currentEquipment.value = eqRes.data || null
      } catch {
        currentEquipment.value = null
      }
    }
  } catch (e) {} finally { loading.value = false }
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  const user = getCurrentUser()
  try {
    const payload = {
      ...form.value,
      status: 'completed'
    }
    if (isEdit.value) {
      await recordApi.updateRecord(route.params.id as string, { ...payload, updatedBy: user?.id })
      ElMessage.success('更新成功')
    } else {
      await recordApi.addRecord({ ...payload, createdBy: user?.id, updatedBy: user?.id } as any)
      ElMessage.success('提交成功')
    }
    router.replace('/record')
  } catch (e) {} finally { submitting.value = false }
}

function formatRecordDate(dateStr: string) {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function initDefaultTime() {
  const now = dayjs()
  form.value.startTime = now.format('YYYY-MM-DD HH:mm')
  form.value.endTime = now.format('YYYY-MM-DD HH:mm')
}

// ========== 照片上传 ==========
const MAX_PHOTOS = 9
const uploadInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxW = 800
        const maxH = 800
        let w = img.width
        let h = img.height
        if (w > maxW || h > maxH) {
          if (w > h) { h = Math.round(h * maxW / w); w = maxW }
          else { w = Math.round(w * maxH / h); h = maxH }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

function triggerUpload() {
  uploadInput.value?.click()
}

function triggerCamera() {
  cameraInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  const remaining = MAX_PHOTOS - form.value.photos.length
  const toProcess = Array.from(files).slice(0, remaining)

  for (const file of toProcess) {
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请选择图片文件')
      continue
    }
    try {
      const base64 = await compressImage(file)
      form.value.photos.push(base64)
    } catch {
      ElMessage.error('图片处理失败')
    }
  }

  if (toProcess.length > 0) {
    ElMessage.success(`已添加 ${toProcess.length} 张图片`)
  }
  // reset input so same file can be re-selected
  input.value = ''
}

function removePhoto(index: number) {
  form.value.photos.splice(index, 1)
}

// ========== 处理结果 ==========
const processResultOptions = getProcessResultOptions()

onMounted(async () => {
  initDefaultTime()
  await loadData()
  loadEquipments()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">{{ isEdit ? '编辑记录' : '填报记录' }}</h2>
      </div>
    </div>

    <div class="form-wrapper" v-loading="loading">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="submitting">

        <!-- ====== 基本信息卡片 ====== -->
        <div class="section-card">
          <div class="section-title">基本信息</div>

          <el-form-item label="记录类型" prop="type">
            <el-radio-group v-model="form.type" @change="onRecordTypeChange" class="type-group">
              <el-radio-button v-for="opt in getRecordTypeOptions()" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="标题" class="form-item-full">
            <div class="input-with-btn">
              <el-input v-model="form.title" placeholder="自动生成，可手动编辑" />
              <el-button type="primary" plain @click="autoGenerateTitle" :disabled="!form.equipmentName">自动生成</el-button>
            </div>
          </el-form-item>

          <el-form-item label="关联设备" prop="equipmentId">
            <el-select v-model="form.equipmentId" filterable placeholder="搜索并选择设备" style="width:100%;" @change="onEquipmentChange">
              <el-option
                v-for="eq in equipments"
                :key="eq.id"
                :value="eq.id"
                :label="`${eq.code} ${eq.name}`"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="维修人员">
            <el-input v-model="form.personnel" placeholder="填写维修人员姓名" />
          </el-form-item>
        </div>

        <!-- ====== 常用模板 ====== -->
        <div class="section-card" v-if="!isEdit && filteredTemplates.length > 0">
          <div class="section-title">常用模板</div>
          <div class="template-chip-row">
            <el-tag
              v-for="tpl in filteredTemplates"
              :key="tpl.id"
              effect="plain"
              class="template-chip"
              @click="applyTemplate(tpl)"
            >
              {{ tpl.name }}
            </el-tag>
            <el-button link type="primary" size="small" @click="router.push('/template')" style="padding:4px 8px;font-size:12px;">
              + 添加模板
            </el-button>
          </div>
        </div>

        <!-- ====== 上次维修参考 ====== -->
        <div class="section-card" v-if="!isEdit && lastRecord">
          <div class="section-title">上次维修参考</div>
          <div class="last-record-card">
            <div class="last-record-title">{{ lastRecord.title }}</div>
            <div class="last-record-content">{{ lastRecord.content }}</div>
            <div class="last-record-time">{{ formatRecordDate(lastRecord.createdAt || lastRecord.updatedAt) }}</div>
          </div>
        </div>

        <!-- ====== 时间信息卡片 ====== -->
        <div class="section-card">
          <div class="section-title">时间信息</div>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="开始时间" prop="startTime">
                <el-date-picker
                  v-model="form.startTime"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm"
                  placeholder="选择开始时间"
                  style="width:100%;"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="结束时间">
                <el-date-picker
                  v-model="form.endTime"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm"
                  placeholder="选择结束时间"
                  style="width:100%;"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="是否停机">
            <el-radio-group v-model="form.isStopped">
              <el-radio value="no">否</el-radio>
              <el-radio value="yes">是</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-row :gutter="16" v-if="form.isStopped === 'yes'">
            <el-col :xs="14" :sm="14">
              <el-form-item label="停机时长">
                <el-input v-model="form.stopDuration" placeholder="输入时长" />
              </el-form-item>
            </el-col>
            <el-col :xs="10" :sm="10">
              <el-form-item label="单位" label-width="50px">
                <el-select v-model="form.stopDurationUnit" style="width:100%;">
                  <el-option label="分钟" value="minutes" />
                  <el-option label="小时" value="hours" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- ====== 作业内容卡片 ====== -->
        <div class="section-card">
          <div class="section-title">作业内容</div>
          <el-form-item label="具体内容" label-width="80px">
            <el-input v-model="form.content" type="textarea" :rows="5" placeholder="详细描述作业内容..." />
          </el-form-item>

          <el-form-item label="处理结果" label-width="80px">
            <el-select v-model="form.result" placeholder="选择处理结果" style="width:100%;">
              <el-option
                v-for="opt in processResultOptions"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="备注" label-width="80px">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（选填）..." />
          </el-form-item>
        </div>

        <!-- ====== 照片记录卡片 ====== -->
        <div class="section-card">
          <div class="section-title">照片记录 ({{ form.photos.length }}/{{ MAX_PHOTOS }})</div>
          <div class="photos-grid">
            <div
              class="photo-item"
              v-for="(photo, index) in form.photos"
              :key="index"
            >
              <img :src="photo" class="photo-img" />
              <div class="photo-delete" @click="removePhoto(index)">
                <el-icon><Close /></el-icon>
              </div>
            </div>
            <div
              class="photo-item upload-btn"
              v-if="form.photos.length < MAX_PHOTOS"
              @click="triggerCamera"
            >
              <el-icon :size="28" color="#909399"><Camera /></el-icon>
              <span class="upload-text">拍照</span>
            </div>
            <div
              class="photo-item upload-btn"
              v-if="form.photos.length < MAX_PHOTOS"
              @click="triggerUpload"
            >
              <el-icon :size="28" color="#909399"><PictureFilled /></el-icon>
              <span class="upload-text">相册</span>
            </div>
          </div>
          <input
            ref="uploadInput"
            type="file"
            accept="image/*"
            multiple
            style="display:none;"
            @change="onFileChange"
          />
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            style="display:none;"
            @change="onFileChange"
          />
        </div>

        <!-- ====== 提交按钮 ====== -->
        <div class="submit-row">
          <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '确认提交' }}
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

/* ====== 卡片分区 ====== */
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

/* ====== 表单元素 ====== */
.type-group :deep(.el-radio-button__inner) {
  border-radius: 6px !important;
  border: 1px solid #dcdfe6 !important;
  box-shadow: none !important;
}

.input-with-btn {
  display: flex;
  gap: 8px;
  width: 100%;
}

.input-with-btn .el-input {
  flex: 1;
}

.template-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.template-chip {
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  padding: 6px 12px;
  line-height: 1.5;
  border-radius: 6px;
  transition: all 0.2s;
}

.template-chip:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  transform: translateY(-1px);
}

.last-record-card {
  background: linear-gradient(135deg, #f0f7ff, #fff);
  border-left: 3px solid #409EFF;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}

.last-record-title {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.last-record-content {
  color: #606266;
  margin-bottom: 4px;
  white-space: pre-wrap;
}

.last-record-time {
  color: #909399;
  font-size: 12px;
}

/* ====== 照片上传 ====== */
.photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.photo-item {
  width: 110px;
  height: 110px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 1px solid #ebeef5;
}

.photo-item.upload-btn {
  background: #fafafa;
  border: 2px dashed #dcdfe6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.photo-item.upload-btn:hover {
  border-color: #409EFF;
  background: #ecf5ff;
}

.upload-text {
  font-size: 12px;
  color: #909399;
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  font-size: 12px;
  transition: background 0.2s;
}

.photo-delete:hover {
  background: rgba(245, 108, 108, 0.85);
}

/* ====== 提交按钮 ====== */
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

/* ====== 移动端优化 ====== */
@media (max-width: 768px) {
  .form-wrapper {
    padding: 12px 12px 32px;
  }

  .section-card {
    padding: 16px 14px 2px;
    margin-bottom: 12px;
    border-radius: 8px;
  }

  .section-title {
    font-size: 14px;
    margin-bottom: 12px;
  }

  .submit-row {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .submit-row :deep(.el-button) {
    width: 100%;
  }

  .photo-item {
    width: 90px;
    height: 90px;
  }

  .input-with-btn .el-button {
    padding: 0 12px;
    font-size: 13px;
    white-space: nowrap;
    flex-shrink: 0;
  }
}
</style>