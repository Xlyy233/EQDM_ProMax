<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, Upload, Search, View, UploadFilled, Document, Loading, Close } from '@element-plus/icons-vue'
import { canManageEquipment, loadFromStorage, isLoggedIn } from '@/stores/user'
import { statusMap } from '@/types'
import type { Equipment, EquipmentStatus, EquipmentAttachment } from '@/types'
import * as equipmentApi from '@/api/equipment'
import * as attachmentApi from '@/api/attachment'
import * as XLSX from 'xlsx'

const router = useRouter()
const keyword = ref('')
const list = ref<Equipment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const showImportDialog = ref(false)
const importStep = ref<'select' | 'preview' | 'result'>('select')
const importData = ref<Partial<Equipment>[]>([])
const importSuccess = ref(false)
const importResultMsg = ref('')

// 附件相关
const attachmentMap = ref<Record<string, EquipmentAttachment[]>>({})
const attachmentLoading = ref<Record<string, boolean>>({})
const previewVisible = ref(false)
const previewUrl = ref('')
const previewName = ref('')

// 权限校验：普通员工不能访问
const hasPermission = canManageEquipment()

onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) {
    router.replace('/login')
    return
  }
  if (!hasPermission) {
    ElMessage.error('您没有权限访问此页面')
    router.replace('/')
    return
  }
  loadData()
})

function loadData() {
  loading.value = true
  equipmentApi.getEquipments({ page: page.value, pageSize: pageSize.value, keyword: keyword.value }).then(res => {
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
    // 加载每台设备的附件
    loadAttachments()
  }).catch(() => {}).finally(() => { loading.value = false })
}

// 批量加载所有设备的附件（一次请求，避免N+1）
function loadAttachments() {
  const ids = list.value.map(eq => eq.id).filter(Boolean)
  if (ids.length === 0) return
  attachmentApi.getBatchAttachments(ids).then(res => {
    const map = res.data || {}
    for (const id of ids) {
      attachmentMap.value[id] = map[id] || []
    }
  }).catch(() => {})
}

// 上传附件（支持批量）
function handleFileUpload(eq: Equipment, event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length === 0) return

  attachmentLoading.value[eq.id] = true
  attachmentApi.uploadAttachment(eq.id, files).then(res => {
    ElMessage.success(res.message || '上传成功')
    attachmentApi.getAttachments(eq.id).then(r => {
      attachmentMap.value[eq.id] = r.data || []
    })
  }).catch(() => {}).finally(() => {
    attachmentLoading.value[eq.id] = false
    input.value = ''
  })
}

// 删除附件
function handleDeleteAttachment(eq: Equipment, att: EquipmentAttachment) {
  ElMessageBox.confirm(`确定删除"${att.originalName}"？`, '确认', { type: 'warning' }).then(() => {
    attachmentApi.deleteAttachment(att.id).then(() => {
      ElMessage.success('已删除')
      attachmentMap.value[eq.id] = (attachmentMap.value[eq.id] || []).filter(a => a.id !== att.id)
    }).catch(() => {})
  }).catch(() => {})
}

// 预览图片
function handlePreview(eq: Equipment, att: EquipmentAttachment) {
  if (attachmentApi.isImageFile(att.mimeType)) {
    previewUrl.value = attachmentApi.getAttachmentUrl(eq.id, att.fileName)
    previewName.value = att.originalName
    previewVisible.value = true
  } else {
    // 非图片文件通过API打开，确保正确的Content-Type
    window.open(attachmentApi.getAttachmentPreviewUrl(eq.id, att.fileName), '_blank')
  }
}

function handleSearch() { page.value = 1; loadData() }
function handlePageChange(p: number) { page.value = p; loadData() }
function handleSizeChange(s: number) { pageSize.value = s; page.value = 1; loadData() }

function handleDelete(id: string) {
  ElMessageBox.confirm('确定删除该设备？', '确认', { type: 'warning' }).then(() => {
    equipmentApi.deleteEquipment(id).then(() => { ElMessage.success('删除成功'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function handleDeleteAll() {
  ElMessageBox.confirm('确定删除所有设备？此操作不可恢复！', '危险操作', { type: 'error', confirmButtonText: '确定删除' }).then(() => {
    equipmentApi.deleteAllEquipments().then(() => { ElMessage.success('已删除全部'); loadData() }).catch(() => {})
  }).catch(() => {})
}

function mapAssetStatus(statusStr: string): EquipmentStatus {
  const m: Record<string, EquipmentStatus> = {
    '正常使用': 'in_use', '使用中': 'in_use', '在用': 'in_use', '运行': 'in_use',
    '停用': 'stopped', '停止使用': 'stopped', '暂停': 'stopped',
    '报废': 'scrapped', '淘汰': 'scrapped'
  }
  return m[statusStr] || 'in_use'
}

function handleImport() {
  showImportDialog.value = true
  importStep.value = 'select'
  importData.value = []
  importSuccess.value = false
}

function downloadTemplate() {
  const templateHeaders = [
    '关键设备', '产线编码', '出厂编号', '新设备编码', '资产类型', '资产状态',
    '资产名称', '品牌', '型号', '数量（台）', '启用日期',
    '出厂日期', '额定功率', '使用位置', '所属部门'
  ]
  const templateRow = ['', '', '', '', '', '正常使用', '', '', '', '', '', '', '', '', '']
  const ws = XLSX.utils.aoa_to_sheet([templateHeaders, templateRow])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '设备台账')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '设备台账导入模板.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('模板下载成功')
}

// 处理 el-upload 的 @change 回调：uploadFile 是 Element Plus 的 UploadFile 对象，其 .raw 属性才是真实的 File
function handleUploadChange(uploadFile: any) {
  const rawFile = uploadFile?.raw as File | undefined
  if (!rawFile) return
  parseExcelFile(rawFile)
}

function parseExcelFile(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

      const result: Partial<Equipment>[] = []
      // 只检测第一行是否为表头，避免把数据行误判为表头
      let startIndex = 0
      const firstRow = jsonData[0]
      if (firstRow && firstRow.length > 0) {
        const firstCell = String(firstRow[0] || '').trim()
        const thirdCell = String(firstRow[3] || '').trim()
        if (firstCell === '关键设备' || firstCell.includes('设备')
          || thirdCell === '新设备编码' || thirdCell.includes('设备编码')) {
          startIndex = 1
        }
      }

      let skippedCount = 0
      for (let i = startIndex; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue
        const deviceCode = String(row[3] || '').trim()
        const deviceName = String(row[6] || '').trim()
        if (!deviceCode || !deviceName) { skippedCount++; continue }
        result.push({
          keyEquipment: String(row[0] || '').trim(),
          productionLineCode: String(row[1] || '').trim(),
          factoryCode: String(row[2] || '').trim(),
          code: String(row[3] || '').trim(),
          assetType: String(row[4] || '').trim(),
          assetStatus: String(row[5] || '').trim(),
          name: String(row[6] || '').trim(),
          brand: String(row[7] || '').trim(),
          model: String(row[8] || '').trim(),
          quantity: String(row[9] || '').trim(),
          enableDate: String(row[10] || '').trim(),
          factoryDate: String(row[11] || '').trim(),
          ratedPower: String(row[12] || '').trim(),
          useLocation: String(row[13] || '').trim(),
          departmentName: String(row[14] || '').trim(),
          department: String(row[14] || row[1] || '').trim(),
          location: String(row[13] || '').trim(),
          purchaseDate: String(row[11] || '').trim(),
          status: mapAssetStatus(String(row[5] || '').trim()),
          qrcode: ''
        })
      }

      if (result.length === 0) {
        ElMessage.warning('文件中没有有效数据')
        return
      }
      if (skippedCount > 0) {
        ElMessage.warning(`已自动跳过 ${skippedCount} 条数据（设备编号或名称为空）`)
      }
      // 检测重复编号
      const codeMap = new Map<string, number>()
      result.forEach((item, idx) => {
        const code = item.code!
        if (codeMap.has(code)) {
          codeMap.set(code, (codeMap.get(code) || 1) + 1)
        } else {
          codeMap.set(code, 1)
        }
      })
      const duplicates: string[] = []
      codeMap.forEach((count, code) => { if (count > 1) duplicates.push(code) })
      if (duplicates.length > 0) {
        ElMessage.warning(`文件中有 ${duplicates.length} 个重复的设备编号：${duplicates.join(', ')}，导入时会被跳过`)
      }
      importData.value = result
      importStep.value = 'preview'
      showImportDialog.value = true
    } catch (err) {
      console.error('Excel读取错误:', err)
      ElMessage.error('读取文件失败，请确保文件格式正确')
    }
  }
  reader.onerror = () => { ElMessage.error('文件读取失败') }
  reader.readAsArrayBuffer(file)
}

async function confirmImport() {
  try {
    const res = await equipmentApi.batchAddEquipment(importData.value as Equipment[])
    if (res) {
      importSuccess.value = true
      importResultMsg.value = res.message || ''
      importStep.value = 'result'
      loadData()
    } else {
      ElMessage.error('导入失败，请重试')
    }
  } catch (e) {
    ElMessage.error('导入失败，请检查网络后重试')
  }
}

function closeImportDialog() {
  showImportDialog.value = false
  importData.value = []
  importResultMsg.value = ''
  importStep.value = 'select'
  importSuccess.value = false
}

</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">设备台账</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <!-- 页面顶部的导入按钮：直接走文件选择 -> 打开带预览的对话框 -->
        <el-upload
          :show-file-list="false"
          :auto-upload="false"
          accept=".xlsx,.xls,.csv"
          @change="handleUploadChange"
          v-if="canManageEquipment()"
        >
          <el-button type="success"><el-icon><Upload /></el-icon>导入文件</el-button>
        </el-upload>
        <el-button type="primary" @click="router.push('/equipment/new')" v-if="canManageEquipment()"><el-icon><Plus /></el-icon>新增设备</el-button>
        <el-button type="danger" @click="handleDeleteAll" v-if="canManageEquipment()">清空全部</el-button>
      </div>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <el-input v-model="keyword" placeholder="搜索设备名称/编号/型号" clearable style="max-width:280px;" @clear="handleSearch" @keyup.enter="handleSearch">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button @click="handleSearch">搜索</el-button>
      <el-button type="success" plain @click="downloadTemplate" v-if="canManageEquipment()">下载导入模板</el-button>
    </div>

    <div class="table-responsive">
    <el-table :data="list" v-loading="loading" border stripe style="width:100%;" empty-text="暂无设备数据" @row-click="(row:any) => router.push(`/equipment/${row.id}`)">
      <el-table-column prop="code" label="设备编号" min-width="120" />
      <el-table-column prop="name" label="设备名称" min-width="140" />
      <el-table-column prop="model" label="规格型号" min-width="120" />
      <el-table-column prop="department" label="所属部门" min-width="100" />
      <el-table-column prop="location" label="安装位置" min-width="100" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status==='in_use'?'success':row.status==='stopped'?'warning':'danger'" size="small">{{ statusMap[row.status] || row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="附件" width="180" align="center">
        <template #default="{ row }">
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;">
            <!-- 附件缩略图列表 -->
            <template v-for="att in (attachmentMap[row.id] || [])" :key="att.id">
              <!-- 图片：显示缩略图 -->
              <div
                v-if="attachmentApi.isImageFile(att.mimeType)"
                style="position:relative;cursor:pointer;width:40px;height:40px;border-radius:4px;overflow:hidden;border:1px solid #e4e7ed;flex-shrink:0;"
                @click.stop="handlePreview(row, att)"
              >
                <img
                  :src="attachmentApi.getAttachmentUrl(row.id, att.fileName)"
                  :alt="att.originalName"
                  style="width:100%;height:100%;object-fit:cover;"
                  :title="att.originalName"
                  loading="lazy"
                />
                <span
                  style="position:absolute;top:0;right:0;background:#f56c6c;border-radius:0 0 0 4px;padding:1px 3px;cursor:pointer;line-height:1;"
                  @click.stop="handleDeleteAttachment(row, att)"
                  title="删除附件"
                >
                  <el-icon :size="12" color="#fff"><Close /></el-icon>
                </span>
              </div>
              <!-- 非图片：显示文件类型图标 -->
              <div
                v-else
                style="position:relative;cursor:pointer;width:40px;height:40px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f5f7fa;border:1px solid #e4e7ed;flex-shrink:0;"
                @click.stop="handlePreview(row, att)"
                :title="att.originalName"
              >
                <el-icon :size="18" color="#909399"><Document /></el-icon>
                <span
                  style="position:absolute;top:0;right:0;background:#f56c6c;border-radius:0 0 0 4px;padding:1px 3px;cursor:pointer;line-height:1;"
                  @click.stop="handleDeleteAttachment(row, att)"
                  title="删除附件"
                >
                  <el-icon :size="12" color="#fff"><Close /></el-icon>
                </span>
              </div>
            </template>
            <!-- 上传按钮 -->
            <label
              :style="{cursor:'pointer',width:'40px',height:'40px',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f7fa',border:'1px dashed #dcdfe6',flexShrink:0,opacity:attachmentLoading[row.id]?0.5:1}"
              :title="attachmentLoading[row.id] ? '上传中...' : '上传附件'"
            >
              <el-icon v-if="!attachmentLoading[row.id]" :size="16" color="#909399"><UploadFilled /></el-icon>
              <el-icon v-else :size="16" color="#909399" class="is-loading"><Loading /></el-icon>
              <input type="file" multiple style="display:none" @change="(e: Event) => handleFileUpload(row, e)" :disabled="attachmentLoading[row.id]" />
            </label>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" v-if="canManageEquipment()" class-name="op-col">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="router.push(`/equipment/${row.id}/edit`)">编辑</el-button>
          <el-button link type="danger" size="small" @click.stop="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <el-pagination
        :current-page="page" :page-size="pageSize"
        :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next"
        @current-change="handlePageChange" @size-change="handleSizeChange"
      />
    </div>

    <!-- 导入结果对话框：解析成功后展示预览 -->
    <el-dialog v-model="showImportDialog" title="导入设备数据" width="720px" :close-on-click-modal="false">
      <div v-if="importStep === 'select'" style="padding:20px 0;">
        <el-empty description="请选择要导入的Excel文件（.xlsx格式）">
          <template #image>
            <div style="font-size:64px;">📥</div>
          </template>
        </el-empty>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
          <el-button @click="downloadTemplate">下载导入模板</el-button>
          <el-upload :show-file-list="false" :auto-upload="false" accept=".xlsx,.xls,.csv" @change="handleUploadChange">
            <el-button type="primary">选择文件</el-button>
          </el-upload>
        </div>
      </div>

      <div v-else-if="importStep === 'preview'">
        <div style="margin-bottom:12px;color:#606266;">
          共解析到 <strong style="color:#409EFF;">{{ importData.length }}</strong> 台设备数据，确认后将导入到系统中
        </div>
        <el-table :data="importData.slice(0, 10)" border size="small" style="width:100%;max-height:320px;overflow:auto;">
          <el-table-column prop="code" label="设备编号" width="110" />
          <el-table-column prop="name" label="设备名称" width="140" show-overflow-tooltip />
          <el-table-column prop="model" label="规格型号" width="100" show-overflow-tooltip />
          <el-table-column prop="brand" label="品牌" width="100" show-overflow-tooltip />
          <el-table-column prop="ratedPower" label="额定功率" width="90" show-overflow-tooltip />
          <el-table-column prop="department" label="所属部门" width="100" show-overflow-tooltip />
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.status==='in_use'?'success':row.status==='stopped'?'warning':'danger'" size="small">{{ statusMap[row.status as keyof typeof statusMap] || row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="importData.length > 10" style="text-align:center;color:#909399;font-size:12px;margin-top:8px;">
          仅显示前10条预览，共 {{ importData.length }} 条
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
          <el-button @click="importStep = 'select'">重新选择</el-button>
          <el-button type="primary" @click="confirmImport">确认导入（{{ importData.length }}条）</el-button>
        </div>
      </div>

      <div v-else-if="importStep === 'result'" style="padding:20px 0;text-align:center;">
        <div :style="{fontSize:'64px',color:importSuccess?'#67C23A':'#F56C6C',marginBottom:'12px'}">
          {{ importSuccess ? '✓' : '✕' }}
        </div>
        <h3>{{ importSuccess ? '导入成功' : '导入失败' }}</h3>
        <p style="color:#909399;">
          {{ importSuccess ? `成功导入 ${importData.length} 台设备数据` : '请检查文件格式后重试' }}
        </p>
        <p v-if="importResultMsg" style="color:#E6A23C;margin-top:4px;">{{ importResultMsg }}</p>
        <el-button type="primary" @click="closeImportDialog">完成</el-button>
      </div>
    </el-dialog>

    <!-- 图片预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="previewName" width="80%" :close-on-click-modal="true" destroy-on-close>
      <div style="text-align:center;max-height:70vh;overflow:auto;">
        <img :src="previewUrl" :alt="previewName" style="max-width:100%;max-height:70vh;object-fit:contain;" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  :deep(.op-col) {
    display: none;
  }
}
</style>
