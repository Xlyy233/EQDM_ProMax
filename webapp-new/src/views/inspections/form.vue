<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isLoggedIn } from '@/stores/user'
import type { Equipment } from '@/types'
import * as api from '@/api/inspection'
import * as equipmentApi from '@/api/equipment'
import { compressImage } from '@/utils/compress'
import { useDraft } from '@/composables/useDraft'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const equipments = ref<Equipment[]>([])
const currentEquipment = ref<Equipment | null>(null)
const templates = ref<any[]>([])
const selectedTemplate = ref<any>(null)
const selectedEquipmentId = ref('')
const selectedTemplateId = ref('')
const templateLoaded = ref(false)

const form = ref({
  inspectionDate: new Date().toISOString().slice(0, 10),
  items: [] as { id: string; content: string; checked: boolean; remark: string }[],
  remark: ''
})

const MAX_PHOTOS = 5
const photos = ref<string[]>([])
const afterPhotos = ref<string[]>([])
const uploadInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const afterUploadInput = ref<HTMLInputElement | null>(null)
const afterCameraInput = ref<HTMLInputElement | null>(null)

// ========== 草稿保护 ==========
const isEdit = ref(false)
const { clearDraft } = useDraft(form, 'draft_inspection', isEdit, submitting)

async function loadEquipments() {
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    equipments.value = res.data?.list || []
  } catch { /* ignore */ }
}

function onEquipmentChange(val: string) {
  const eq = equipments.value.find(e => e.id === val)
  currentEquipment.value = eq || null
  selectedTemplateId.value = ''
  templates.value = []
  selectedTemplate.value = null
  form.value.items = []
  if (eq && eq.type) {
    loadTemplates(eq.type)
  }
}

async function loadTemplates(equipmentType: string) {
  templateLoaded.value = false
  try {
    const res = await api.getTemplatesByType(equipmentType)
    templates.value = res.data.data || []
  } catch { /* ignore */ }
  finally { templateLoaded.value = true }
}

function onTemplateChange(val: string) {
  const t = templates.value.find(t => t.id === val)
  selectedTemplate.value = t || null
  if (t) {
    form.value.items = t.items.map((it: any) => ({
      id: it.id,
      content: it.content,
      checked: true,
      remark: ''
    }))
  } else {
    form.value.items = []
  }
}

function triggerUpload() { uploadInput.value?.click() }
function triggerCamera() { cameraInput.value?.click() }
function triggerAfterUpload() { afterUploadInput.value?.click() }
function triggerAfterCamera() { afterCameraInput.value?.click() }

async function onFileChange(e: Event, target: 'photos' | 'afterPhotos') {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  const arr = target === 'photos' ? photos.value : afterPhotos.value
  const remaining = MAX_PHOTOS - arr.length
  const toProcess = Array.from(files).slice(0, remaining)
  for (const file of toProcess) {
    if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); continue }
    try { const b64 = await compressImage(file, { maxW: 1200, maxH: 1200, quality: 0.5 }); arr.push(b64) } catch { ElMessage.error('图片处理失败') }
  }
  if (toProcess.length > 0) ElMessage.success(`已添加 ${toProcess.length} 张图片`)
  input.value = ''
}

function removePhoto(index: number) { photos.value.splice(index, 1) }
function removeAfterPhoto(index: number) { afterPhotos.value.splice(index, 1) }

async function handleSubmit() {
  if (!currentEquipment.value) { ElMessage.warning('请选择设备'); return }
  if (!selectedTemplate.value) { ElMessage.warning('请选择巡检模板'); return }
  if (form.value.items.length === 0) { ElMessage.warning('巡检项目为空'); return }
  submitting.value = true
  try {
    await api.createRecord({
      templateId: selectedTemplate.value.id,
      templateName: selectedTemplate.value.name,
      equipmentId: currentEquipment.value.id,
      equipmentCode: currentEquipment.value.code,
      equipmentName: currentEquipment.value.name,
      inspectionDate: form.value.inspectionDate,
      items: form.value.items,
      photos: photos.value,
      afterPhotos: afterPhotos.value,
      remark: form.value.remark
    })
    ElMessage.success('巡检记录已提交')
    clearDraft()
    router.push('/inspections/list')
  } catch { ElMessage.error('提交失败') }
  finally { submitting.value = false }
}

onMounted(() => {
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadEquipments()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">开始巡检</h2>
    </div>

    <div class="form-card">
      <!-- 选择设备和模板 -->
      <el-form label-width="80px" class="form-sm">
        <el-form-item label="选择设备">
          <el-select v-model="selectedEquipmentId" placeholder="请选择设备" filterable style="width:100%" @change="onEquipmentChange">
            <el-option v-for="eq in equipments" :key="eq.id" :label="eq.code + ' - ' + eq.name" :value="eq.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="巡检模板" v-if="currentEquipment">
          <el-select v-model="selectedTemplateId" placeholder="请选择巡检模板" style="width:100%" @change="onTemplateChange">
            <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <div v-if="templateLoaded && templates.length === 0" style="color:#909399;font-size:13px;margin-top:4px;">
            <el-icon style="vertical-align:middle;"><Warning /></el-icon> 该设备类型暂无巡检模板，请联系部门经理在「巡检模板」页面配置
          </div>
        </el-form-item>
        <el-form-item label="巡检日期">
          <el-date-picker v-model="form.inspectionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>

      <!-- 巡检项目清单 -->
      <div v-if="form.items.length > 0" class="checklist-section">
        <div class="section-title">巡检项目</div>
        <div v-for="(item, index) in form.items" :key="item.id" class="checklist-item">
          <div class="checklist-header">
            <span class="checklist-num">{{ index + 1 }}.</span>
            <span class="checklist-content">{{ item.content }}</span>
            <el-switch v-model="item.checked" active-text="通过" inactive-text="不通过" size="small" />
          </div>
          <el-input
            v-if="!item.checked"
            v-model="item.remark"
            placeholder="注明异常情况（选填）"
            size="small"
            style="margin-top:6px;"
          />
        </div>
      </div>

      <!-- 处理前照片 -->
      <div class="section-card">
        <div class="section-title">操作处理前现场照片 ({{ photos.length }}/{{ MAX_PHOTOS }})</div>
        <div class="photos-grid">
          <div class="photo-item" v-for="(p, i) in photos" :key="i">
            <img :src="p" class="photo-img" loading="lazy" />
            <div class="photo-delete" @click="removePhoto(i)"><el-icon><Close /></el-icon></div>
          </div>
          <div class="photo-item upload-btn" v-if="photos.length < MAX_PHOTOS" @click="triggerCamera">
            <el-icon :size="28" color="#909399"><Camera /></el-icon><span class="upload-text">拍照</span>
          </div>
          <div class="photo-item upload-btn" v-if="photos.length < MAX_PHOTOS" @click="triggerUpload">
            <el-icon :size="28" color="#909399"><PictureFilled /></el-icon><span class="upload-text">相册</span>
          </div>
        </div>
        <input ref="uploadInput" type="file" accept="image/*" multiple style="display:none" @change="onFileChange($event, 'photos')" />
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" style="display:none" @change="onFileChange($event, 'photos')" />
      </div>

      <!-- 处理后照片 -->
      <div class="section-card">
        <div class="section-title">操作处理后现场照片 ({{ afterPhotos.length }}/{{ MAX_PHOTOS }})</div>
        <div class="photos-grid">
          <div class="photo-item" v-for="(p, i) in afterPhotos" :key="i">
            <img :src="p" class="photo-img" loading="lazy" />
            <div class="photo-delete" @click="removeAfterPhoto(i)"><el-icon><Close /></el-icon></div>
          </div>
          <div class="photo-item upload-btn" v-if="afterPhotos.length < MAX_PHOTOS" @click="triggerAfterCamera">
            <el-icon :size="28" color="#909399"><Camera /></el-icon><span class="upload-text">拍照</span>
          </div>
          <div class="photo-item upload-btn" v-if="afterPhotos.length < MAX_PHOTOS" @click="triggerAfterUpload">
            <el-icon :size="28" color="#909399"><PictureFilled /></el-icon><span class="upload-text">相册</span>
          </div>
        </div>
        <input ref="afterUploadInput" type="file" accept="image/*" multiple style="display:none" @change="onFileChange($event, 'afterPhotos')" />
        <input ref="afterCameraInput" type="file" accept="image/*" capture="environment" style="display:none" @change="onFileChange($event, 'afterPhotos')" />
      </div>

      <!-- 备注 -->
      <el-form label-width="80px" style="margin-top:16px;">
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" rows="2" placeholder="巡检总体备注（选填）" />
        </el-form-item>
      </el-form>

      <div style="text-align:center;margin-top:24px;">
        <el-button type="primary" size="large" @click="handleSubmit" :loading="submitting" style="width:200px;">
          提交巡检记录
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.form-sm :deep(.el-form-item) { margin-bottom: 14px; }

.checklist-section {
  margin: 16px 0;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}
.checklist-item {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}
.checklist-item:last-child { border-bottom: none; }
.checklist-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.checklist-num { color: #909399; font-size: 13px; flex-shrink: 0; }
.checklist-content { flex: 1; font-size: 14px; }

.section-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}
.photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-item {
  width: 110px;
  height: 110px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  position: relative;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: #f5f7fa;
  border: 1px dashed #c0c4cc;
}
.upload-text { font-size: 11px; color: #909399; margin-top: 2px; }

@media (max-width: 768px) {
  .form-card { margin: 0 12px; padding: 14px; }
  .photo-item { width: 90px; height: 90px; }
}
</style>