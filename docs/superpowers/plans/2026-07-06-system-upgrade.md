# 系统升级方案：KPI看板 + 备件库存 + 数据备份 + 拍照压缩 + 草稿保护

> **目标：** 提升数据决策价值、完善设备管理链条、保障数据安全、优化移动端体验

---

## 一、KPI 看板升级

### 现状分析

当前统计页面已有：仪表盘概览卡片（设备总数、本月维修/保养/巡检数）、趋势图、类型分布饼图、成本分析、预测分析。后端 `/dashboard` 接口已计算了 MTTR 和可用率，但前端未展示。

### 升级方案

#### 后端：新增 `GET /api/statistics/kpi` 接口

在 `statistics.js` 中新增接口，返回：

```js
{
  mttr: 2.5,              // 平均修复时间（小时），已有
  mtbf: 48.3,             // 平均故障间隔（天），新增
  availabilityRate: 96.7, // 设备可用率（%），已有    是
  maintenanceExecutionRate: 85.2, // 保养执行率（%），新增
  // 同比环比
  repairTrend: { current: 15, last: 12, lastYear: 18 },  // 维修次数
  maintenanceTrend: { current: 8, last: 10, lastYear: 6 }, // 保养次数
  // 本月 Top 5 故障设备
  topFaultEquipments: [{ name: '设备A', count: 5 }, ...]
}
```

**MTBF 计算逻辑：**
- 遍历维修记录，按设备分组
- 对每台设备：按时排序维修记录，计算相邻两次维修的时间间隔，取平均值
- 所有设备的 MTBF 加权平均

**保养执行率计算逻辑：**
- 本月已完成的保养计划数 / 本月应执行的保养计划总数 × 100%
- "已完成" = 状态为 `completed` 的保养计划
- "应执行" = 本月 `nextMaintenanceDate` 落在当前月份的保养计划

#### 前端：统计页面新增 KPI 卡片区

在统计页面顶部（概览卡片下方）新增一行 KPI 卡片：

| 卡片 | 指标 | 格式 |
|------|------|------|
| MTTR | 平均修复时间 | 2.5 小时 |
| MTBF | 平均故障间隔 | 48.3 天 |
| 可用率 | 设备可用率 | 96.7% |
| 保养执行率 | 保养执行率 | 85.2% |

每个卡片下方显示环比变化（↑12% / ↓5%），绿色上升、红色下降。

#### 改动文件

| 文件 | 改动 |
|------|------|
| `backend/routes/statistics.js` | 新增 `/kpi` 接口 |
| `webapp-new/src/api/statistics.ts` | 新增 `getKpiData()` 方法 |
| `webapp-new/src/types/index.ts` | 新增 `KpiData` 类型 |
| `webapp-new/src/views/statistics/index.vue` | 新增 KPI 卡片区域 |

---

## 二、备件库存管理

### 数据模型

```json
{
  "id": "sp_001",
  "name": "轴承 6205-2RS",
  "spec": "6205-2RS / SKF",
  "quantity": 25,
  "minStock": 5,
  "unit": "个",
  "location": "A区货架3层",
  "equipmentId": "eq_001",
  "equipmentName": "CNC加工中心-01",
  "remark": "适用于主轴",
  "createdAt": "2026-07-06 10:00:00",
  "updatedAt": "2026-07-06 10:00:00"
}
```

### 后端路由：`backend/routes/spareParts.js`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/spare-parts` | 列表（支持搜索、低库存筛选） | 所有用户 |
| GET | `/api/spare-parts/low-stock` | 低库存预警列表 | 所有用户 |
| GET | `/api/spare-parts/:id` | 详情 | 所有用户 |
| POST | `/api/spare-parts` | 新增 | 经理/管理员 |
| PUT | `/api/spare-parts/:id` | 编辑 | 经理/管理员 |
| PUT | `/api/spare-parts/:id/stock-in` | 入库（增加数量） | 经理/管理员 |
| PUT | `/api/spare-parts/:id/stock-out` | 出库（减少数量） | 经理/管理员 |
| DELETE | `/api/spare-parts/:id` | 删除 | 经理/管理员 |

**出入库记录：** 每次出入库操作自动记录日志，包含操作人、数量变化、时间。

### 前端页面

**列表页：** `webapp-new/src/views/spare-parts/list.vue`
- 搜索框 + 分类筛选
- 库存数量低于 `minStock` 时红色高亮
- 经理/管理员可见新增按钮
- 每行展示：名称、规格、库存数、最低库存、存放位置

**表单页：** `webapp-new/src/views/spare-parts/form.vue`
- 备件名称、规格型号、单位、库存数量、最低库存、存放位置、关联设备、备注
- 出入库操作：在详情页通过按钮触发，弹出出入库数量和备注

**首页预警：** 仪表盘新增"低库存备件"卡片，显示库存不足的备件数量

### 改动文件

| 文件 | 改动 |
|------|------|
| `backend/routes/spareParts.js` | 新建 |
| `backend/index.js` | 注册路由 |
| `webapp-new/src/api/sparePart.ts` | 新建 |
| `webapp-new/src/types/index.ts` | 新增 `SparePart` 类型 |
| `webapp-new/src/router/index.ts` | 新增备件管理路由 |
| `webapp-new/src/views/spare-parts/list.vue` | 新建 |
| `webapp-new/src/views/spare-parts/form.vue` | 新建 |
| `webapp-new/src/components/MainLayout.vue` | 侧边栏添加"备件库存"菜单 |
| `webapp-new/src/views/dashboard/index.vue` | 首页添加低库存预警卡片 |

---

## 三、数据自动备份

### 方案设计

**备份策略：** 定时备份 + 启动备份 + 保留策略

- **启动时备份：** 每次后端启动时，自动备份一次当前数据
- **定时备份：** 每天凌晨 2:00 自动备份（使用 `setInterval` 每小时检查一次）
- **保留策略：** 保留最近 30 份备份，自动删除旧备份
- **手动备份：** 管理员可在日志管理页面手动触发备份

**备份目录：** `backend/data/backups/`
**备份命名：** `eqdm_YYYYMMDD_HHmmss.json`

### 实现方式

在 `backend/index.js` 中新增备份模块，不引入第三方依赖（node-cron），使用 `setInterval` 每小时检查一次：

```js
function backupData() {
  const src = path.join(dataDir, 'eqdm.json');
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(backupDir, `eqdm_${timestamp}.json`);
  fs.copyFileSync(src, dest);
  
  // 清理旧备份：保留最近30份
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('eqdm_'))
    .sort()
    .reverse();
  for (let i = 30; i < files.length; i++) {
    fs.unlinkSync(path.join(backupDir, files[i]));
  }
}
```

**手动备份接口：** `POST /api/system/backup`（仅管理员）

### 改动文件

| 文件 | 改动 |
|------|------|
| `backend/index.js` | 新增备份逻辑和定时器 |
| `backend/routes/logs.js` | 新增 `POST /api/system/backup` |

---

## 四、拍照压缩优化

### 现状分析

当前 `compressImage` 函数已实现：
- 最大尺寸 800×800
- JPEG 质量 0.6（记录页）/ 0.8（巡检页）
- 时间戳水印

**存在的问题：** base64 编码会增加约 33% 体积，一张 800×800 的 JPEG 约 100-200KB，base64 后约 130-260KB。5 张照片最大约 1.3MB。

### 优化方案

**1. 调整压缩参数：**
- 最大尺寸从 800 降至 600（手机上查看足够清晰）
- 质量从 0.6 降至 0.5
- 预计单张照片体积从 ~150KB 降至 ~60KB，5 张约 300KB

**2. 统一压缩函数：**
- 将 `compressImage` 抽取为公共工具函数 `webapp-new/src/utils/compress.ts`
- 记录表单和巡检表单共用同一个压缩函数
- 巡检表单当前质量 0.8，统一为 0.5

**3. 压缩后文件大小日志（开发调试用）：**
- 在 console 输出压缩前后大小对比，便于验证效果

### 改动文件

| 文件 | 改动 |
|------|------|
| `webapp-new/src/utils/compress.ts` | 新建公共压缩函数 |
| `webapp-new/src/views/record/form.vue` | 改用公共函数，参数调整 |
| `webapp-new/src/views/inspections/form.vue` | 改用公共函数，参数调整 |

---

## 五、表单草稿保护

### 问题分析

用户在填写记录时，刷新页面、误触返回、手机锁屏后页面被系统回收，都会导致已填写的内容丢失。需要一种零感知的自动保存机制。

### 方案设计

**核心思路：** localStorage 自动保存 + beforeunload 拦截 + 恢复提示

#### 1. 自动保存

- 使用 `watch` 监听整个 `form` 对象，变化时自动保存到 localStorage
- 使用 `useDebounceFn`（来自 @vueuse/core）防抖 500ms，避免频繁写入
- 存储 key：`draft_record`（记录页）、`draft_inspection`（巡检页）
- 存储内容：`{ form, timestamp }`

#### 2. 页面加载恢复

- `onMounted` 时检查 localStorage 是否有草稿
- 如果有且非编辑模式，弹出确认框："检测到上次未完成的记录，是否恢复？"
- 用户点"恢复"：填充表单数据
- 用户点"不恢复"：清除草稿

#### 3. 离开拦截

- 注册 `window.addEventListener('beforeunload', ...)` 
- 如果表单有内容（非空），设置 `event.returnValue = ''` 触发浏览器原生提示
- 提交成功后清除草稿和移除拦截

#### 4. 草稿清除时机

- 提交成功后立即清除
- 用户手动清除（确认框选"不恢复"时）
- 草稿超过 24 小时自动失效（在加载时检查时间戳）

### 实现方式

在 `record/form.vue` 和 `inspections/form.vue` 中分别添加（逻辑相同，可抽取为 composable）：

```ts
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const DRAFT_KEY = 'draft_record'

// 保存草稿
const saveDraft = useDebounceFn(() => {
  const hasContent = form.value.equipmentId || form.value.content || form.value.title
  if (hasContent) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: form.value, timestamp: Date.now() }))
  }
}, 500)

watch(form, saveDraft, { deep: true })

// 恢复草稿
onMounted(() => {
  if (!isEdit.value) {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      try {
        const draft = JSON.parse(raw)
        if (Date.now() - draft.timestamp < 24 * 3600 * 1000) {
          ElMessageBox.confirm('检测到上次未完成的记录，是否恢复？', '恢复草稿', {
            confirmButtonText: '恢复',
            cancelButtonText: '不恢复'
          }).then(() => {
            form.value = draft.form
          }).catch(() => {
            localStorage.removeItem(DRAFT_KEY)
          })
        } else {
          localStorage.removeItem(DRAFT_KEY)
        }
      } catch { localStorage.removeItem(DRAFT_KEY) }
    }
  }
  // 拦截离开
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  const hasContent = form.value.equipmentId || form.value.content || form.value.title
  if (hasContent && !submitting.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// 提交成功后
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}
// 在 handleSubmit 成功时调用 clearDraft()
```

### 改动文件

| 文件 | 改动 |
|------|------|
| `webapp-new/src/views/record/form.vue` | 添加草稿自动保存/恢复逻辑 |
| `webapp-new/src/views/inspections/form.vue` | 添加草稿自动保存/恢复逻辑 |

---

## 执行顺序

1. **拍照压缩优化**（风险最低，改动最小）
2. **数据自动备份**（零前端改动，后端独立）
3. **表单草稿保护**（独立功能，影响两个表单页）
4. **KPI 看板升级**（后端+前端联动）
5. **备件库存管理**（新模块，工作量最大）

---

## 风险评估

| 项目 | 风险 | 应对 |
|------|------|------|
| 拍照压缩 | 低 | 已有函数，仅调参数 |
| 数据备份 | 低 | 独立逻辑，不涉及业务 |
| 草稿保护 | 低 | 仅前端，不影响已有数据 |
| KPI看板 | 低 | 新增接口，不修改已有接口 |
| 备件库存 | 中 | 新模块，独立数据表，不影响现有功能 |