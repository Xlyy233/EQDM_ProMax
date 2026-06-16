<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, Upload, Search } from '@element-plus/icons-vue'
import { canManageEquipment, loadFromStorage, isLoggedIn } from '@/stores/user'
import { statusMap } from '@/types'
import type { Equipment, EquipmentStatus } from '@/types'
import * as equipmentApi from '@/api/equipment'
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
  }).catch(() => {}).finally(() => { loading.value = false })
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
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

      const result: Partial<Equipment>[] = []
      let startIndex = 0
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue
        const firstCell = String(row[0] || '').trim()
        const thirdCell = String(row[3] || '').trim()
        const isHeader = firstCell === '关键设备' || firstCell.includes('设备')
          || thirdCell === '新设备编码' || thirdCell.includes('设备编码') || thirdCell.includes('编码')
        if (!isHeader) { startIndex = i; break }
      }

      for (let i = startIndex; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue
        const deviceCode = String(row[3] || '').trim()
        if (!deviceCode) continue
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
  importStep.value = 'select'
  importSuccess.value = false
}

onMounted(loadData)
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
      <el-table-column label="操作" width="150" fixed="right" v-if="canManageEquipment()">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="router.push(`/equipment/${row.id}/edit`)">编辑</el-button>
          <el-button link type="danger" size="small" @click.stop="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <el-pagination
        v-model:current-page="page" v-model:page-size="pageSize"
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
        <el-button type="primary" @click="closeImportDialog">完成</el-button>
      </div>
    </el-dialog>
  </div>
</template>
