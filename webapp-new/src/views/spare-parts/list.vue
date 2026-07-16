<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isLoggedIn, getCurrentUser } from '@/stores/user'
import type { SparePart } from '@/types'
import * as api from '@/api/sparePart'

const router = useRouter()
const user = getCurrentUser()
const isManager = computed(() => user?.role === 'admin' || user?.role === 'manager')

const loading = ref(false)
const list = ref<SparePart[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const lowStockOnly = ref(false)

const stockDialogVisible = ref(false)
const stockDialogType = ref<'in' | 'out'>('in')
const stockDialogPart = ref<SparePart | null>(null)
const stockAmount = ref(1)
const stockRemark = ref('')

async function loadData() {
  loading.value = true
  try {
    const res = await api.getSpareParts({
      keyword: keyword.value || undefined,
      lowStock: lowStockOnly.value ? 'true' : undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch { ElMessage.error('加载备件列表失败') }
  finally { loading.value = false }
}

function onSearch() { page.value = 1; loadData() }
function onPageChange(p: number) { page.value = p; loadData() }
function onSizeChange(s: number) { pageSize.value = s; page.value = 1; loadData() }

function goForm(id?: string) {
  router.push(id ? `/spare-parts/form?id=${id}` : '/spare-parts/form')
}

function openStockDialog(part: SparePart, type: 'in' | 'out') {
  stockDialogPart.value = part
  stockDialogType.value = type
  stockAmount.value = 1
  stockRemark.value = ''
  stockDialogVisible.value = true
}

async function handleStock() {
  if (!stockDialogPart.value) return
  const amount = stockAmount.value
  if (amount <= 0) { ElMessage.warning('数量必须大于0'); return }
  try {
    if (stockDialogType.value === 'in') {
      await api.stockIn(stockDialogPart.value.id, amount, stockRemark.value)
      ElMessage.success('入库成功')
    } else {
      await api.stockOut(stockDialogPart.value.id, amount, stockRemark.value)
      ElMessage.success('出库成功')
    }
    stockDialogVisible.value = false
    loadData()
  } catch { ElMessage.error('操作失败') }
}

async function handleDelete(part: SparePart) {
  try {
    await ElMessageBox.confirm(`确定删除备件「${part.name}」吗？`, '删除确认', { type: 'warning' })
    await api.deleteSparePart(part.id)
    ElMessage.success('删除成功')
    loadData()
  } catch { /* cancel */ }
}

onMounted(() => {
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadData()
})
</script>

<template>
  <div class="sp-container">
    <div class="sp-header">
      <h2>备件库存管理</h2>
      <el-button v-if="isManager" type="primary" @click="goForm()">新增备件</el-button>
    </div>

    <div class="sp-filter">
      <el-input v-model="keyword" placeholder="搜索名称/规格/关联设备" clearable style="width: 260px;" @clear="onSearch" @keyup.enter="onSearch">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-checkbox v-model="lowStockOnly" @change="onSearch">仅显示低库存</el-checkbox>
      <el-button @click="onSearch">搜索</el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe style="width:100%">
      <el-table-column prop="name" label="备件名称" min-width="140" />
      <el-table-column prop="spec" label="规格型号" min-width="120" show-overflow-tooltip />
      <el-table-column label="库存数量" width="120" align="center">
        <template #default="{ row }">
          <span :class="{ 'low-stock': row.quantity <= row.minStock }">
            {{ row.quantity }} {{ row.unit }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="最低库存" width="100" align="center">
        <template #default="{ row }">{{ row.minStock }} {{ row.unit }}</template>
      </el-table-column>
      <el-table-column prop="location" label="存放位置" min-width="120" show-overflow-tooltip />
      <el-table-column prop="equipmentName" label="关联设备" min-width="120" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column label="操作" width="240" fixed="right" v-if="isManager">
        <template #default="{ row }">
          <el-button size="small" @click="openStockDialog(row, 'in')">入库</el-button>
          <el-button size="small" @click="openStockDialog(row, 'out')">出库</el-button>
          <el-button size="small" @click="goForm(row.id)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="sp-pagination" v-if="total > pageSize">
      <el-pagination
        background layout="prev, pager, next"
        :total="total" :page-size="pageSize" :current-page="page"
        @current-change="onPageChange" @size-change="onSizeChange"
      />
    </div>

    <!-- 出入库弹窗 -->
    <el-dialog v-model="stockDialogVisible" :title="stockDialogType === 'in' ? '入库' : '出库'" width="400px">
      <div v-if="stockDialogPart">
        <p style="margin-bottom:12px;">备件：<strong>{{ stockDialogPart.name }}</strong>（当前库存：{{ stockDialogPart.quantity }} {{ stockDialogPart.unit }}）</p>
        <el-form label-width="80px">
          <el-form-item label="数量">
            <el-input-number v-model="stockAmount" :min="1" :max="stockDialogType === 'out' ? stockDialogPart.quantity : 99999" />
            <span style="margin-left:8px;">{{ stockDialogPart.unit }}</span>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="stockRemark" placeholder="可选" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="stockDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleStock">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sp-container { padding: 20px 24px; }
.sp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.sp-header h2 { margin: 0; font-size: 18px; color: #303133; }
.sp-filter { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.low-stock { color: #ef4444; font-weight: 700; }
.sp-pagination { margin-top: 16px; display: flex; justify-content: center; }

@media (max-width: 768px) {
  .sp-container { padding: 12px; }
  .sp-filter { flex-direction: column; align-items: stretch; }
  .sp-filter .el-input { width: 100% !important; }
}
</style>