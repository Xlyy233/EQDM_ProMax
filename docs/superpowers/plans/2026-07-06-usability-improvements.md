# 系统易用性优化方案

> **For agentic workers:** 按任务顺序执行，每个任务独立可验证。步骤使用 `- [ ]` checkbox 跟踪。

**目标：** 在不改变权限模型的前提下，优化10个功能点的易用性和逻辑合理性

**架构：** 纯前端改动，不涉及后端API变更。所有改动集中在 Vue 组件层面，通过现有 API 完成数据交互。

**技术栈：** Vue 3 + Element Plus + TypeScript

---

### Task 1: 首页快捷操作 - 添加"开始巡检"入口

**文件：**
- 修改: `webapp-new/src/views/dashboard/index.vue`

**说明：** 桌面端首页快捷操作区当前有"扫码识别"和"填报记录"，缺少"开始巡检"入口。员工每次巡检都要从侧边栏进入，路径太长。

- [ ] **Step 1: 在 actions 数组中添加巡检入口**

找到 `actions` 数组定义（约第51行），在 `{ label: '填报记录', ... }` 之后添加：

```ts
const actions = [
  { label: '扫码识别', icon: 'Camera', route: '/equipment/scan', show: true },
  { label: '填报记录', icon: 'Edit', route: '/record/new', show: true },
  { label: '开始巡检', icon: 'CircleCheck', route: '/inspections/form', show: true },  // 新增
  { label: '工作记录', icon: 'Document', route: '/record', show: true },
  // ... 其余不变
]
```

- [ ] **Step 2: 验证**

重启前端 dev server 或刷新页面，确认首页快捷操作区出现"开始巡检"按钮，点击后跳转到 `/inspections/form`。

---

### Task 2: 移动端底部导航 - 添加"保养计划"入口

**文件：**
- 修改: `webapp-new/src/components/MainLayout.vue`

**说明：** 移动端底部导航只有4个按钮，缺少保养计划入口。一线员工在车间需要快速查看自己负责设备的保养计划。

- [ ] **Step 1: 在底部导航数组中添加保养计划按钮**

找到底部导航（约第98行），在巡检按钮后添加保养计划：

```html
<button v-for="item in [
  { path:'/',label:'首页',icon:'HomeFilled' },
  { path:'/equipment',label:'设备',icon:'Box',show:canManageEquipment() },
  { path:'/record',label:'记录',icon:'Document' },
  { path:'/inspections/list',label:'巡检',icon:'DocumentChecked' },
  { path:'/maintenance',label:'保养',icon:'Calendar',show:canManageMaintenance() }
].filter(i => i.show !== false)"
```

- [ ] **Step 2: 验证**

在移动端视口（<768px）刷新页面，确认底部导航出现5个按钮，其中"保养"按钮点击跳转到 `/maintenance`。

---

### Task 3: 保养计划列表 - 逾期状态筛选和高亮

**文件：**
- 修改: `webapp-new/src/views/maintenance/list.vue`

**说明：** 当前状态筛选只有"全部/进行中/已暂停/已完成"，缺少"已逾期"筛选。逾期的保养计划也缺少视觉高亮。

- [ ] **Step 1: 添加"逾期"筛选标签**

在 `statusTabs` 数组中添加"逾期"选项（约第21行）：

```ts
const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'active' },
  { label: '已逾期', value: 'overdue' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' }
]
```

- [ ] **Step 2: 添加逾期判断的 computed 属性**

在 `<script setup>` 中添加：

```ts
const isOverdue = (plan: MaintenancePlan): boolean => {
  if (!plan.nextMaintenanceDate || plan.status !== 'active') return false
  const next = new Date(plan.nextMaintenanceDate)
  if (isNaN(next.getTime())) return false
  return next.getTime() < Date.now()
}
```

- [ ] **Step 3: 修改 loadData 函数，支持逾期筛选**

修改 `loadData` 函数（约第42行），在列表加载后添加逾期筛选逻辑：

```ts
function loadData() {
  loading.value = true
  const params: any = { page: page.value, pageSize: pageSize.value }
  if (keyword.value) params.keyword = keyword.value
  if (activeStatus.value && activeStatus.value !== 'overdue') params.status = activeStatus.value
  maintenanceApi.getPlans(params).then(res => {
    let resultList = res.data?.list || []
    // 逾期筛选：客户端过滤
    if (activeStatus.value === 'overdue') {
      resultList = resultList.filter(p => isOverdue(p))
    }
    list.value = resultList
    total.value = activeStatus.value === 'overdue' ? resultList.length : (res.data?.total || 0)
  }).catch(() => {}).finally(() => { loading.value = false })
}
```

- [ ] **Step 4: 卡片上添加逾期视觉高亮**

修改卡片区域的 `el-tag`（约第135行），在状态标签后添加逾期标识：

```html
<div class="card-title-row">
  <span class="card-title">{{ plan.planName }}</span>
  <el-tag
    :type="plan.status==='active'?(isOverdue(plan)?'danger':'success'):plan.status==='paused'?'warning':'info'"
    size="small"
  >{{ isOverdue(plan) ? '已逾期' : maintenanceStatusMap[plan.status] }}</el-tag>
</div>
```

同时给卡片添加逾期样式类，在 `plan-card` 的 class 上：

```html
<div
  class="plan-card"
  :class="{ 'plan-overdue': isOverdue(plan) }"
  ...
>
```

- [ ] **Step 5: 添加逾期卡片的CSS样式**

在 `<style scoped>` 末尾添加：

```css
.plan-card.plan-overdue {
  border-left: 3px solid #F56C6C;
  background: #FFF5F5;
}
```

- [ ] **Step 6: 验证**

刷新保养计划页面，确认：
1. 状态筛选栏出现"已逾期"标签
2. 点击"已逾期"只显示已逾期的保养计划
3. 逾期的卡片左侧有红色边框，状态标签显示为红色"已逾期"

---

### Task 4: 巡检表单 - 无模板时的提示

**文件：**
- 修改: `webapp-new/src/views/inspections/form.vue`

**说明：** 员工选了设备类型后，如果没有配置巡检模板，模板下拉框为空且没有任何提示，体验不好。

- [ ] **Step 1: 添加"模板已加载"状态标记**

在 `<script setup>` 中已有的变量附近添加：

```ts
const templateLoaded = ref(false)
```

- [ ] **Step 2: 修改 loadTemplates 函数**

修改 `loadTemplates` 函数（约第53行）：

```ts
async function loadTemplates(equipmentType: string) {
  templateLoaded.value = false
  try {
    const res = await api.getTemplatesByType(equipmentType)
    templates.value = res.data.data || []
  } catch { /* ignore */ }
  finally { templateLoaded.value = true }
}
```

- [ ] **Step 3: 在模板选择区域添加空状态提示**

在模板的 `el-select` 下方添加提示文字。找到模板选择区域（约在 `onTemplateChange` 附近），在 `el-select` 下方添加：

```html
<el-form-item label="巡检模板">
  <el-select v-model="selectedTemplateId" placeholder="选择巡检模板" ...>
    ...
  </el-select>
  <div v-if="currentEquipment && templateLoaded && templates.length === 0" style="color:#909399;font-size:12px;margin-top:6px;">
    <el-icon style="vertical-align:middle;"><Warning /></el-icon>
    该设备类型暂无巡检模板，请联系部门经理在「巡检模板」页面配置
  </div>
</el-form-item>
```

- [ ] **Step 4: 验证**

选择一个没有配置巡检模板的设备类型，确认模板下拉框下方出现提示文字。

---

### Task 5: 扫码页面 - 扫描后操作选择

**文件：**
- 修改: `webapp-new/src/views/equipment/scan.vue`

**说明：** 当前扫码后直接跳转到填报记录页面。但有时员工扫码只是想查看设备详情，而不是立刻填记录。应在扫码后提供操作选择。

- [ ] **Step 1: 添加操作选择弹窗状态**

在 `<script setup>` 中添加：

```ts
const showActionDialog = ref(false)
const scannedEquipmentId = ref('')
const scannedEquipmentName = ref('')
```

- [ ] **Step 2: 修改 handleScanResult，改为弹出选择**

修改 `handleScanResult` 函数（约第30行）：

```ts
function handleScanResult(result: string) {
  stopScanning()
  const params = parseUrlParams(result)
  if (params) {
    scannedEquipmentId.value = params.equipmentId
    scannedEquipmentName.value = params.equipmentName || ''
    showActionDialog.value = true
  } else {
    ElMessage.warning('无法识别的二维码内容，请扫描设备二维码')
    scanning.value = false
  }
}
```

- [ ] **Step 3: 添加操作选择弹窗**

在模板的 `</div>` (扫码区域结束) 之后、手动输入区域之前，添加弹窗：

```html
<!-- 操作选择弹窗 -->
<el-dialog v-model="showActionDialog" title="请选择操作" width="300px" :close-on-click-modal="false">
  <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0;">
    <el-button type="primary" size="large" @click="goToRecord">
      <el-icon><Edit /></el-icon> 填报记录
    </el-button>
    <el-button size="large" @click="goToDetail">
      <el-icon><View /></el-icon> 查看设备详情
    </el-button>
  </div>
</el-dialog>
```

- [ ] **Step 4: 添加跳转方法**

在 `<script setup>` 中添加：

```ts
function goToRecord() {
  showActionDialog.value = false
  router.push(`/record/new?equipmentId=${encodeURIComponent(scannedEquipmentId.value)}&equipmentName=${encodeURIComponent(scannedEquipmentName.value)}`)
}

function goToDetail() {
  showActionDialog.value = false
  router.push(`/equipment/${scannedEquipmentId.value}`)
}
```

- [ ] **Step 5: 验证**

扫码设备二维码，确认弹出操作选择弹窗，两个按钮分别跳转到正确的页面。

---

### Task 6: 记录填报 - 历史参考匹配当前记录类型

**文件：**
- 修改: `webapp-new/src/views/record/form.vue`

**说明：** 当前选了设备后只展示"上次维修参考"，但如果当前记录类型是"保养"，应该展示上次保养记录作为参考。

- [ ] **Step 1: 修改 loadLastRecord 函数，增加类型参数**

修改 `loadLastRecord` 函数（约第134行）：

```ts
async function loadLastRecord(equipmentId: string, recordType?: string) {
  try {
    const params: any = { equipmentId, page: 1, pageSize: 1 }
    if (recordType) params.type = recordType
    const res = await recordApi.getRecords(params)
    if (res.data?.list && res.data.list.length > 0) {
      lastRecord.value = res.data.list[0]
    } else {
      lastRecord.value = null
    }
  } catch {
    lastRecord.value = null
  }
}
```

- [ ] **Step 2: 修改调用处，传入当前类型**

修改 `onEquipmentChange` 函数（约第87行）中的调用：

```ts
function onEquipmentChange(val: string) {
  const eq = equipments.value.find(e => e.id === val)
  if (eq) {
    form.value.equipmentId = eq.id
    form.value.equipmentCode = eq.code
    form.value.equipmentName = eq.name
    saveRecentEquipment({ id: eq.id, code: eq.code, name: eq.name })
    autoGenerateTitle()
    loadLastRecord(eq.id, form.value.type)  // 传入当前类型
  }
}
```

- [ ] **Step 3: 添加类型切换时重新加载历史记录**

修改 `onRecordTypeChange` 函数（约第83行）：

```ts
function onRecordTypeChange() {
  autoGenerateTitle()
  if (form.value.equipmentId) {
    loadLastRecord(form.value.equipmentId, form.value.type)
  }
}
```

- [ ] **Step 4: 修改模板中历史参考的标题**

找到"上次维修参考" текст（约第419行），改为动态标题：

```html
<div class="section-card" v-if="!isEdit && lastRecord">
  <div class="section-title">上次{{ getRecordTypeOptions().find(o => o.value === form.type)?.label || '' }}参考</div>
```

- [ ] **Step 5: 验证**

1. 选一台设备，切换到"保养"类型，确认显示的是"上次保养参考"
2. 切换到"维修"类型，确认显示的是"上次维修参考"

---

### Task 7: 记录填报 - 时间选择器快捷填入当前时间

**文件：**
- 修改: `webapp-new/src/views/record/form.vue`

**说明：** 现场员工填记录时，经常需要填入"刚刚处理完"的时间。datetime picker 在手机上操作不便，应添加"填入当前时间"快捷按钮。

- [ ] **Step 1: 添加填入当前时间的方法**

在 `<script setup>` 中添加：

```ts
function fillCurrentTime(field: 'startTime' | 'endTime') {
  form.value[field] = dayjs().format('YYYY-MM-DD HH:mm')
}
```

- [ ] **Step 2: 在开始时间选择器后添加快捷按钮**

找到开始时间的 `el-date-picker`（约第433行），在其后添加按钮：

```html
<el-form-item label="开始时间" prop="startTime">
  <div style="display:flex;gap:8px;width:100%;">
    <el-date-picker
      v-model="form.startTime"
      type="datetime"
      format="YYYY-MM-DD HH:mm"
      value-format="YYYY-MM-DD HH:mm"
      placeholder="选择开始时间"
      style="flex:1;"
    />
    <el-button @click="fillCurrentTime('startTime')" size="small">当前</el-button>
  </div>
</el-form-item>
```

- [ ] **Step 3: 在结束时间选择器后添加同样的按钮**

同样方式修改结束时间（约第444行）：

```html
<el-form-item label="结束时间">
  <div style="display:flex;gap:8px;width:100%;">
    <el-date-picker
      v-model="form.endTime"
      type="datetime"
      format="YYYY-MM-DD HH:mm"
      value-format="YYYY-MM-DD HH:mm"
      placeholder="选择结束时间"
      style="flex:1;"
    />
    <el-button @click="fillCurrentTime('endTime')" size="small">当前</el-button>
  </div>
</el-form-item>
```

- [ ] **Step 4: 验证**

打开填报记录页面，点击开始时间和结束时间旁的"当前"按钮，确认时间自动填入当前日期时间。

---

### Task 8: 知识库 - 添加"故障案例"分类

**文件：**
- 修改: `webapp-new/src/views/knowledge/index.vue`
- 修改: `webapp-new/src/views/knowledge/form.vue`

**说明：** 现有分类：全部、工作流程、技术分享、工具技巧、最佳实践。缺少"故障案例"——设备部知识库的核心内容。

- [ ] **Step 1: 在知识库列表页添加分类**

修改 `knowledge/index.vue` 中的 `categories` 数组（约第10行）：

```ts
const categories = [
  { id: 'all', label: '全部', icon: 'Grid' },
  { id: 'workflow', label: '工作流程', icon: 'Connection' },
  { id: 'tech', label: '技术分享', icon: 'Monitor' },
  { id: 'tools', label: '工具技巧', icon: 'Setting' },
  { id: 'bestpractice', label: '最佳实践', icon: 'Medal' },
  { id: 'case', label: '故障案例', icon: 'Warning' },
]
```

- [ ] **Step 2: 在知识库表单页添加分类**

修改 `knowledge/form.vue` 中的 `categories` 数组（约第24行）：

```ts
const categories = [
  { id: 'tech', label: '技术分享' },
  { id: 'workflow', label: '工作流程' },
  { id: 'tools', label: '工具技巧' },
  { id: 'bestpractice', label: '最佳实践' },
  { id: 'case', label: '故障案例' },
]
```

- [ ] **Step 3: 验证**

1. 知识库列表页的分类筛选栏出现"故障案例"标签
2. 发布知识页面分类下拉框出现"故障案例"选项
3. 选择"故障案例"分类后可以正常发布和筛选

---

### Task 9: 巡检记录列表 - 设备筛选

**文件：**
- 修改: `webapp-new/src/views/inspections/list.vue`

**说明：** 巡检记录列表只有搜索框和日期筛选，缺少按设备筛选的选项。设备多了以后，员工想查看某台设备的巡检记录只能靠搜索。

- [ ] **Step 1: 添加设备列表和筛选状态**

在 `<script setup>` 中添加：

```ts
import type { Equipment } from '@/types'
import * as equipmentApi from '@/api/equipment'

const equipmentList = ref<Equipment[]>([])
const filterEquipmentId = ref('')
```

- [ ] **Step 2: 添加加载设备列表的方法**

```ts
async function loadEquipmentList() {
  try {
    const res = await equipmentApi.getEquipments({ pageSize: 999 })
    equipmentList.value = res.data?.list || []
  } catch { /* ignore */ }
}
```

- [ ] **Step 3: 修改 loadData，支持设备筛选**

修改 `loadData` 函数（约第18行）：

```ts
async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    if (filterEquipmentId.value) params.equipmentId = filterEquipmentId.value
    const res = await api.getRecords(params)
    list.value = res.data.data?.list || []
    total.value = res.data.data?.total || 0
  } catch { ElMessage.error('加载记录失败') }
  finally { loading.value = false }
}
```

- [ ] **Step 4: 在 onMounted 中加载设备列表**

```ts
onMounted(() => {
  loadFromStorage()
  if (!isLoggedIn()) { router.replace('/login'); return }
  loadData()
  loadEquipmentList()
})
```

- [ ] **Step 5: 在搜索栏添加设备筛选下拉框**

在模板的搜索栏区域（日期选择器附近）添加：

```html
<el-select v-model="filterEquipmentId" placeholder="筛选设备" clearable @change="loadData" style="width:200px;">
  <el-option
    v-for="eq in equipmentList"
    :key="eq.id"
    :value="eq.id"
    :label="eq.code + ' ' + eq.name"
  />
</el-select>
```

- [ ] **Step 6: 验证**

打开巡检记录列表，确认设备筛选下拉框出现，选择一个设备后列表只显示该设备的巡检记录。

---

### Task 10: 保养计划详情 - 跳转填报保养记录

**文件：**
- 修改: `webapp-new/src/views/maintenance/detail.vue`

**说明：** 保养计划详情页有"完成保养"按钮，但只是标记状态。如果员工想执行保养并填写详细记录，需要手动去记录页面新建。应添加"填写保养记录"快捷按钮。

- [ ] **Step 1: 添加跳转方法**

在 `<script setup>` 中添加：

```ts
function goToRecord() {
  if (!plan.value) return
  router.push(`/record/new?equipmentId=${encodeURIComponent(plan.value.equipmentId)}&equipmentName=${encodeURIComponent(plan.value.equipmentName)}`)
}
```

- [ ] **Step 2: 在按钮区添加"填写保养记录"按钮**

在按钮区域（约第65行），在"完成保养"按钮之前添加：

```html
<div style="display:flex;gap:8px;" v-if="plan">
  <el-button type="primary" @click="goToRecord">
    <el-icon><Edit /></el-icon> 填写保养记录
  </el-button>
  <el-button v-if="plan.status==='active'" type="success" @click="handleComplete">
    <el-icon><Check /></el-icon> 完成保养
  </el-button>
  <!-- ... 其余按钮不变 -->
</div>
```

- [ ] **Step 3: 验证**

打开保养计划详情页，点击"填写保养记录"按钮，确认跳转到填报记录页面，且设备已自动选中，记录类型应为"保养"。

---

## 执行顺序建议

所有任务互相独立，可按任意顺序执行。建议按优先级：
1. Task 3（保养逾期高亮）— 管理决策影响最大
2. Task 4（巡检无模板提示）— 影响所有巡检员工
3. Task 7（时间快捷填入）— 移动端高频操作
4. Task 6（历史参考匹配类型）— 逻辑合理性
5. Task 5（扫码操作选择）— 扫码体验优化
6. Task 1 + Task 2（快捷入口）— 导航便捷性
7. Task 8 + Task 9 + Task 10 — 辅助功能优化