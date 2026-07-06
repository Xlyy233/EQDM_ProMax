# EQDM_ProMax 设备台账与运维管理系统 API 文档

> 版本：1.1.0 | 基础地址：`http://localhost:3000`

---

## 通用说明

### 响应格式

所有接口统一返回 JSON，格式如下：

```json
{
  "code": 200,
  "data": { ... },
  "message": "操作成功"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 200-成功，401-未认证，403-无权限，404-不存在，500-服务端错误 |
| data | any | 响应数据 |
| message | string | 提示信息 |

### 认证方式

除登录和扫码接口外，所有接口需在请求头携带 JWT Token：

```
Authorization: Bearer <token>
```

### 分页参数

支持分页的接口统一使用以下 Query 参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页条数 |

分页响应格式：

```json
{
  "code": 200,
  "data": {
    "list": [],
    "total": 0,
    "page": 1,
    "pageSize": 20
  },
  "message": "操作成功"
}
```

---

## 一、认证模块 `/api/auth`

### 1.1 用户登录

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/auth/login` |
| 认证 | 否 |

**请求体**：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应**：

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "u_xxx",
      "username": "admin",
      "realName": "管理员",
      "role": "admin",
      "department": "技术部",
      "createdAt": "2026-01-01 08:00:00",
      "updatedAt": "2026-01-01 08:00:00"
    }
  },
  "message": "登录成功"
}
```

---

## 二、用户管理 `/api/users`

### 2.1 获取用户列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/users` |
| 认证 | 是 |

**Query 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| keyword | string | 搜索用户名/真实姓名 |
| role | string | 角色筛选：employee / manager / admin |
| department | string | 部门筛选 |

### 2.2 获取当前用户信息

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/users/profile` |
| 认证 | 是 |

### 2.3 获取指定用户详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/users/:id` |
| 认证 | 是 |

### 2.4 修改密码

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/users/change-password` |
| 认证 | 是 |

**请求体**：

```json
{
  "oldPassword": "old123",
  "newPassword": "new456"
}
```

### 2.5 创建用户（管理员）

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/users` |
| 认证 | 是（管理员） |

**请求体**：

```json
{
  "username": "zhangsan",
  "password": "123456",
  "realName": "张三",
  "role": "employee",
  "department": "生产部"
}
```

### 2.6 更新用户（管理员）

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/users/:id` |
| 认证 | 是（管理员） |

**请求体**：

```json
{
  "realName": "张三丰",
  "password": "newpass",
  "role": "manager",
  "department": "技术部"
}
```

### 2.7 删除用户（管理员）

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/users/:id` |
| 认证 | 是（管理员） |

注意：不能删除当前登录用户。

---

## 三、设备管理 `/api/equipments`

### 3.1 获取设备列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/equipments` |
| 认证 | 是 |

**Query 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| keyword | string | 搜索设备编号/名称/型号 |
| department | string | 部门筛选 |
| status | string | 状态筛选：in_use / stopped / scrapped |

### 3.2 获取部门列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/equipments/departments` |
| 认证 | 是 |

**响应**：`string[]` 部门名称数组。

### 3.3 通过二维码查询设备

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/equipments/qrcode?qrcode=EQDM-XXX` |
| 认证 | 是 |

### 3.4 获取设备详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/equipments/:id` |
| 认证 | 是 |

### 3.5 创建设备

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/equipments` |
| 认证 | 是 |

**请求体**：

```json
{
  "code": "XJ-PEF1-001",
  "name": "PEF1-真空上料机",
  "model": "PEF1",
  "purchaseDate": "2025-01-01",
  "department": "生产部",
  "location": "A车间1号工位",
  "status": "in_use",
  "keyEquipment": "是",
  "productionLineCode": "L01",
  "factoryCode": "F2025001",
  "assetType": "生产设备",
  "assetStatus": "正常使用",
  "brand": "XX品牌",
  "quantity": "1",
  "enableDate": "2025-01-01",
  "factoryDate": "2024-12-01",
  "ratedPower": "5.5kW",
  "useLocation": "A车间",
  "departmentName": "生产部"
}
```

### 3.6 批量导入设备

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/equipments/batch` |
| 认证 | 是 |

**请求体**：`Equipment[]` 数组，与 3.5 字段一致。

**响应**：

```json
{
  "code": 200,
  "data": { "added": 10, "skipped": 2 },
  "message": "批量导入完成，成功 10 条，跳过 2 条"
}
```

### 3.7 更新设备

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/equipments/:id` |
| 认证 | 是 |

**请求体**：同 3.5，仅需传入需要更新的字段。

### 3.8 删除设备

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/equipments/:id` |
| 认证 | 是 |

注意：有运维记录关联的设备无法删除。

### 3.9 清空全部设备

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/equipments/all` |
| 认证 | 是 |

注意：同时删除关联的记录和维保计划。

### 3.10 获取设备类型列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/equipments/types` |
| 认证 | 是 |

**响应**：`string[]` 去重后的设备类型名称数组，按字母排序。

### 3.11 批量更新设备类型

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/equipments/batch-types` |
| 认证 | 是 |

**请求体**：

```json
{
  "updates": [
    { "id": "e_xxx", "type": "挤压机" },
    { "id": "e_yyy", "type": "切割机" }
  ]
}
```

**响应**：

```json
{
  "code": 200,
  "data": { "count": 2 },
  "message": "操作成功"
}
```

---

## 四、工作记录 `/api/records`

### 4.1 获取记录列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/records` |
| 认证 | 是 |

**Query 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| keyword | string | 搜索标题/内容/设备名称 |
| type | string | 类型：repair / maintenance / inspection / improvement |
| status | string | 状态：completed / approved / pending |
| equipmentId | string | 按设备筛选 |
| createdBy | string | 按创建人筛选 |
| startTime | string | 开始时间（筛选范围） |
| endTime | string | 结束时间（筛选范围） |

### 4.2 获取记录统计

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/records/stats` |
| 认证 | 是 |

**Query 参数**：`startTime`, `endTime`

**响应**：

```json
{
  "code": 200,
  "data": {
    "total": 100,
    "repair": 30,
    "maintenance": 25,
    "inspection": 25,
    "improvement": 20
  }
}
```

### 4.3 获取记录详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/records/:id` |
| 认证 | 是 |

**响应中的记录对象**：

```json
{
  "id": "r_xxx",
  "equipmentId": "e_xxx",
  "equipmentCode": "XJ-PEF1-001",
  "equipmentName": "PEF1-真空上料机",
  "type": "repair",
  "title": "[XJ-PEF1-001] PEF1-真空上料机 维修 2026-07-01",
  "content": "维修内容描述",
  "faultDescription": "故障现象",
  "faultCause": "故障原因分析",
  "solution": "解决办法",
  "startTime": "2026-07-01 09:00",
  "endTime": "2026-07-01 11:00",
  "result": "fixed",
  "remark": "备注",
  "photos": ["data:image/jpeg;base64,..."],
  "status": "completed",
  "personnel": "张三",
  "isStopped": "no",
  "stopDuration": "",
  "stopDurationUnit": "minutes",
  "partsReplaced": "no",
  "partsReplacedDetail": "",
  "cost": 0,
  "laborCost": 0,
  "partsCost": 0,
  "otherCost": 0,
  "createdBy": "u_xxx",
  "updatedBy": "u_xxx",
  "createdAt": "2026-07-01 08:00:00",
  "updatedAt": "2026-07-01 08:00:00"
}
```

### 4.4 创建记录

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/records` |
| 认证 | 是 |

**请求体**：同 4.3 记录对象字段，`equipmentId` 和 `type` 为必填。

创建成功后会自动为所有其他用户生成通知。

### 4.5 更新记录

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/records/:id` |
| 认证 | 是 |

**请求体**：同 4.3，仅需传入需要更新的字段。

### 4.6 删除记录

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/records/:id` |
| 认证 | 是 |

---

## 五、维保计划 `/api/maintenance-plans`

### 5.1 获取计划列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/maintenance-plans` |
| 认证 | 是 |

**Query 参数**：`page`, `pageSize`, `keyword`, `status`, `equipmentId`

### 5.2 获取即将维保计划

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/maintenance-plans/upcoming?days=30` |
| 认证 | 是 |

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| days | number | 30 | 未来 N 天内 |

### 5.3 获取计划详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/maintenance-plans/:id` |
| 认证 | 是 |

### 5.4 创建计划

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/maintenance-plans` |
| 认证 | 是 |

**请求体**：

```json
{
  "equipmentId": "e_xxx",
  "equipmentName": "PEF1-真空上料机",
  "equipmentCode": "XJ-PEF1-001",
  "planName": "月度保养计划",
  "cycleType": "monthly",
  "cycleValue": 1,
  "lastMaintenanceDate": "2026-06-01",
  "nextMaintenanceDate": "2026-07-01",
  "responsibleUserId": "u_xxx",
  "responsibleUserName": "张三",
  "status": "active",
  "remark": "备注"
}
```

| cycleType 可选值 | 说明 |
|------------------|------|
| daily | 每天 |
| weekly | 每周 |
| monthly | 每月 |
| quarterly | 每季度 |
| yearly | 每年 |

### 5.5 完成维保

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/maintenance-plans/:id/complete` |
| 认证 | 是 |

自动将 `lastMaintenanceDate` 设为当天，`nextMaintenanceDate` 按周期递推。

### 5.6 更新计划

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/maintenance-plans/:id` |
| 认证 | 是 |

### 5.7 删除计划

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/maintenance-plans/:id` |
| 认证 | 是 |

---

## 六、统计分析 `/api/statistics`

### 6.1 仪表板数据

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/dashboard` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "totalEquipments": 50,
    "inUseCount": 40,
    "stoppedCount": 8,
    "scrappedCount": 2,
    "monthlyRepairCount": 12,
    "monthlyMaintenanceCount": 8,
    "monthlyInspectionCount": 15,
    "mttr": 2.5,
    "availabilityRate": 80.0,
    "pendingRecords": 3,
    "completedRecords": 97
  }
}
```

### 6.2 月度统计

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/monthly?year=2026&month=7` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "monthlyFailureRate": 30.0,
    "monthlyRecords": {
      "repair": 10,
      "maintenance": 5,
      "inspection": 8,
      "improvement": 3
    },
    "equipmentFailureRates": [
      {
        "equipmentId": "e_xxx",
        "equipmentName": "PEF1-真空上料机",
        "failureRate": 50.0,
        "repairCount": 5,
        "inspectionCount": 5
      }
    ],
    "vulnerableParts": [
      {
        "partName": "密封圈",
        "replaceCount": 8,
        "equipmentCount": 1,
        "equipmentList": ["密封圈"]
      }
    ]
  }
}
```

### 6.3 趋势数据

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/trend?days=30` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": [
    {
      "date": "2026-07-01",
      "repair": 2,
      "maintenance": 1,
      "inspection": 3,
      "improvement": 0
    }
  ]
}
```

### 6.4 设备 KPI

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/equipment-kpi/:equipmentId` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "equipmentId": "e_xxx",
    "equipmentName": "PEF1-真空上料机",
    "mtbf": 30.0,
    "mttr": 2.5,
    "availabilityRate": 92.0,
    "totalRepairCost": 1500.00,
    "repairCount": 5,
    "maintenanceCount": 3
  }
}
```

### 6.5 部门统计

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/department` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": [
    {
      "department": "生产部",
      "equipmentCount": 15,
      "repairCount": 20,
      "maintenanceCount": 10,
      "failureRate": 66.7
    }
  ]
}
```

### 6.6 成本分析

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/cost?months=6` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "totalCost": 5000.00,
    "laborCost": 3000.00,
    "partsCost": 1500.00,
    "otherCost": 500.00,
    "monthlyCosts": [
      { "month": "2026-07", "cost": 800.00 }
    ]
  }
}
```

### 6.7 记录类型分布

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/record-type-distribution` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": [
    { "name": "维修", "value": 30, "color": "#ef4444" },
    { "name": "保养", "value": 20, "color": "#3b82f6" },
    { "name": "巡检", "value": 25, "color": "#10b981" },
    { "name": "改善", "value": 15, "color": "#f59e0b" }
  ]
}
```

### 6.8 配件更换统计

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/parts-replacement` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "totalReplacements": 20,
    "partsList": [
      {
        "equipmentName": "PEF1-真空上料机",
        "equipmentId": "e_xxx",
        "detail": "密封圈",
        "date": "2026-07-01",
        "type": "repair"
      }
    ],
    "partsStats": [
      { "name": "密封圈", "count": 8 }
    ],
    "equipmentStats": [
      { "name": "PEF1-真空上料机", "count": 5, "details": ["密封圈", "轴承"] }
    ]
}
```

### 6.9 预测分析

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/statistics/predictive` |
| 认证 | 是 |

**说明**：基于设备台账、维修记录、巡检记录、保养计划四类数据，进行综合预测分析，包括设备健康评分、保养逾期预警、保养效果评估、保养周期建议、配件更换预测和预防性维护建议。

**响应**：

```json
{
  "code": 200,
  "data": {
    "healthScores": [
      {
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机",
        "equipmentCode": "XJ-PEF1-001",
        "score": 72,
        "riskLevel": "low",
        "repairCount": 5,
        "inspectionFailRate": 15,
        "ageDays": 365,
        "partsCount": 2,
        "maintenanceCompliance": 80,
        "maintenanceOverdue": 0
      }
    ],
    "highRiskEquipments": [
      {
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机",
        "equipmentCode": "XJ-PEF1-001",
        "score": 35,
        "riskLevel": "high",
        "repairCount": 8,
        "inspectionFailRate": 40,
        "ageDays": 730,
        "partsCount": 5,
        "maintenanceCompliance": 50,
        "maintenanceOverdue": 15,
        "repairTrend": "up",
        "topFailItems": ["温度异常(3次)", "压力不足(2次)"]
      }
    ],
    "repairTrends": [
      {
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机",
        "monthly": [1, 0, 2, 3, 2, 4],
        "trend": "up"
      }
    ],
    "maintenanceAnalysis": {
      "complianceRate": 60,
      "overduePlans": [
        {
          "equipmentId": "e_xxx",
          "planName": "季度润滑",
          "nextMaintenanceDate": "2026-06-20",
          "overdueDays": 14
        }
      ],
      "upcomingPlans": [
        {
          "equipmentId": "e_yyy",
          "planName": "月度检查",
          "nextMaintenanceDate": "2026-07-10",
          "daysUntil": 6
        }
      ],
      "ineffectiveMaintenances": [
        {
          "equipmentId": "e_xxx",
          "equipmentName": "780T铝型材挤压机",
          "maintenanceDate": "2026-06-01",
          "repairAfterCount": 3,
          "minDaysToRepair": 5
        }
      ],
      "cycleSuggestions": [
        {
          "equipmentId": "e_xxx",
          "equipmentName": "780T铝型材挤压机",
          "planName": "季度润滑",
          "currentCycleDays": 90,
          "suggestedCycleDays": 30,
          "avgRepairGapDays": 30
        }
      ]
    },
    "partsPredictions": [
      {
        "partName": "密封圈",
        "avgCycleDays": 60,
        "lastReplaceDate": "2026-06-01",
        "predictedNext": "2026-08-01",
        "daysUntil": 28,
        "priority": "medium"
      }
    ],
    "suggestions": [
      {
        "type": "urgent",
        "title": "保养逾期",
        "content": "设备 780T铝型材挤压机 的保养计划「季度润滑」已逾期 14 天，该设备本月已发生 2 次维修，建议立即安排保养",
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机"
      },
      {
        "type": "danger",
        "title": "高风险设备",
        "content": "设备 780T铝型材挤压机 健康评分 35 分（高风险），近 6 月维修 8 次，巡检不通过率 40%，保养逾期 15 天，建议安排全面检查",
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机"
      },
      {
        "type": "warning",
        "title": "配件更换预警",
        "content": "配件「密封圈」预计 28 天后需要更换（2026-08-01），建议提前备货",
        "equipmentId": "",
        "equipmentName": ""
      },
      {
        "type": "info",
        "title": "保养周期建议",
        "content": "设备 780T铝型材挤压机 的「季度润滑」当前周期 90 天，但平均故障间隔仅 30 天，建议调整为 30 天",
        "equipmentId": "e_xxx",
        "equipmentName": "780T铝型材挤压机"
      }
    ]
  }
}
```

**评分维度说明**：

| 维度 | 满分 | 说明 |
|------|------|------|
| 维修频率 | 25 | 近 6 个月维修次数，每次扣 5 分 |
| 巡检通过率 | 20 | 巡检不通过率每 10% 扣 2 分 |
| 设备年龄 | 10 | 每使用 1 年扣 2 分 |
| 配件更换 | 15 | 每次配件更换扣 3 分 |
| 保养执行率 | 15 | 执行率每降低 10% 扣 1.5 分 |
| 保养逾期 | 15 | 每逾期 3 天扣 1 分 |

**风险等级**：`high`（< 40 分，高风险）、`medium`（40-70 分，中风险）、`low`（> 70 分，低风险）

**建议类型**：`urgent`（紧急，红色）、`danger`（危险，红色）、`warning`（警告，橙色）、`info`（提示，蓝色）

**配件优先级**：`high`（14 天内）、`medium`（30 天内）、`low`（30 天以上）

---

## 七、通知 `/api/notifications`

### 7.1 获取未读通知

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/notifications/unread` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "n_xxx",
        "type": "new_record",
        "title": "新工作记录",
        "content": "张三 提交了「PEF1-真空上料机」的维修记录",
        "targetUrl": "/record/r_xxx",
        "targetUserId": "u_xxx",
        "read": false,
        "createdAt": "2026-07-01 08:00:00"
      }
    ],
    "unreadCount": 5
  }
}
```

### 7.2 获取全部通知

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/notifications?page=1&pageSize=20` |
| 认证 | 是 |

### 7.3 标记已读

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/notifications/:id/read` |
| 认证 | 是 |

### 7.4 全部标记已读

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/notifications/read-all` |
| 认证 | 是 |

---

## 八、附件管理 `/api/attachments`

### 8.1 获取设备附件列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/attachments/equipment/:equipmentId` |
| 认证 | 是 |

### 8.2 批量获取多设备附件

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/attachments/equipment/batch` |
| 认证 | 是 |

**请求体**：

```json
{
  "equipmentIds": ["e_xxx", "e_yyy"]
}
```

**响应**：

```json
{
  "code": 200,
  "data": {
    "e_xxx": [
      {
        "id": "a_xxx",
        "equipmentId": "e_xxx",
        "originalName": "设备照片.jpg",
        "fileName": "abc123.jpg",
        "mimeType": "image/jpeg",
        "size": 102400,
        "createdBy": "u_xxx",
        "createdAt": "2026-07-01 08:00:00"
      }
    ]
  }
}
```

### 8.3 上传附件

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/attachments/equipment/:equipmentId` |
| 认证 | 是 |
| 格式 | `multipart/form-data`，字段名 `files` |

**限制**：单文件最大 20MB，支持 jpg/jpeg/png/gif/webp/pdf/doc/docx/xls/xlsx/txt/zip/rar，最多同时上传 20 个文件。

### 8.4 删除附件

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/attachments/:id` |
| 认证 | 是 |

---

## 九、知识库 `/api/knowledge`

### 9.1 获取知识列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/knowledge?page=1&pageSize=20&category=tech&keyword=xxx` |
| 认证 | 是 |

**Query 参数**：`page`, `pageSize`, `category`（分类筛选）, `keyword`（搜索标题/内容/标签）

### 9.2 获取知识详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/knowledge/:id` |
| 认证 | 是 |

**响应**包含 `images` 图片数组和 `liked` 当前用户是否已点赞。

### 9.3 上传图片

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/knowledge/upload` |
| 认证 | 是 |
| 格式 | `multipart/form-data`，字段名 `files` |

**限制**：单文件最大 20MB，支持 jpg/jpeg/png/gif/webp/bmp，最多 10 张。

**响应**：

```json
{
  "code": 200,
  "data": [
    { "id": "kimg_xxx", "url": "/uploads/knowledge/abc.jpg", "originalName": "照片.jpg" }
  ]
}
```

### 9.4 创建文章

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/knowledge` |
| 认证 | 是 |

**请求体**：

```json
{
  "title": "PEF1真空上料机常见故障排查",
  "content": "<p>文章内容（支持HTML）</p>",
  "summary": "摘要",
  "category": "tech",
  "tags": ["故障排查", "真空上料机"],
  "coverImageId": "kimg_xxx",
  "imageIds": ["kimg_xxx", "kimg_yyy"]
}
```

| category 可选值 | 说明 |
|-----------------|------|
| tech | 技术文档 |
| experience | 经验分享 |
| manual | 操作手册 |
| other | 其他 |

### 9.5 更新文章

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/knowledge/:id` |
| 认证 | 是 |

**请求体**：同 9.4。

### 9.6 删除文章

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/knowledge/:id` |
| 认证 | 是 |

同时删除关联图片文件、评论和点赞记录。

### 9.7 点赞/取消点赞

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/knowledge/:id/like` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": { "liked": true, "likeCount": 5 },
  "message": "点赞成功"
}
```

### 9.8 获取评论列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/knowledge/:id/comments` |
| 认证 | 是 |

### 9.9 添加评论

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/knowledge/:id/comments` |
| 认证 | 是 |

**请求体**：

```json
{
  "content": "评论内容"
}
```

### 9.10 删除评论

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/knowledge/comments/:commentId` |
| 认证 | 是 |

注意：仅评论作者或管理员可删除。

---

## 十、数据导出

### 10.1 导出记录 CSV

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/export/records?startTime=xxx&endTime=xxx&type=repair&equipmentId=xxx` |
| 认证 | 是 |

**Query 参数**：`startTime`, `endTime`, `type`, `equipmentId`, `format=json`（返回 JSON 而非 CSV 文件）

### 10.2 导出设备 CSV

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/export/equipments` |
| 认证 | 是 |

### 10.3 导出记录 Excel

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/export-excel/records?startTime=xxx&endTime=xxx` |
| 认证 | 是 |
| 响应 | Excel 二进制文件 |

**限制**：最大导出 500 条，照片从第 16 列（P 列）开始放置。

---

## 十一、巡检模块 `/api/inspections`

### 11.1 获取巡检模板列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/templates` |
| 认证 | 是 |

**Query 参数**：`page`, `pageSize`, `keyword`（搜索模板名称）

### 11.2 获取模板详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/templates/:id` |
| 认证 | 是 |

### 11.3 按设备类型获取模板

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/templates/by-type/:equipmentType` |
| 认证 | 是 |

**说明**：员工巡检时，根据所选设备的类型自动加载对应模板。

### 11.4 创建模板

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/inspections/templates` |
| 认证 | 是（经理/管理员） |

**请求体**：

```json
{
  "name": "挤压机日常巡检",
  "equipmentType": "挤压机",
  "items": [
    { "content": "检查液压系统压力是否正常", "order": 0 },
    { "content": "检查温度传感器是否正常", "order": 1 },
    { "content": "检查润滑系统是否正常", "order": 2 }
  ]
}
```

### 11.5 更新模板

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/inspections/templates/:id` |
| 认证 | 是（经理/管理员） |

### 11.6 删除模板

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/inspections/templates/:id` |
| 认证 | 是（经理/管理员） |

### 11.7 获取巡检记录列表

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/records?page=1&pageSize=20` |
| 认证 | 是 |

**Query 参数**：`page`, `pageSize`, `keyword`（搜索设备名称/编号/模板名称）、`startDate`、`endDate`

### 11.8 获取巡检记录详情

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/records/:id` |
| 认证 | 是 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "id": "imr_xxx",
    "templateId": "imt_xxx",
    "templateName": "挤压机日常巡检",
    "equipmentId": "e_xxx",
    "equipmentCode": "XJ-PEF1-001",
    "equipmentName": "780T铝型材挤压机",
    "equipmentType": "挤压机",
    "inspectionDate": "2026-07-04",
    "status": "completed",
    "items": [
      {
        "content": "检查液压系统压力是否正常",
        "order": 0,
        "checked": true,
        "remark": ""
      },
      {
        "content": "检查温度传感器是否正常",
        "order": 1,
        "checked": false,
        "remark": "温度偏高，需要关注"
      }
    ],
    "photos": ["data:image/jpeg;base64,..."],
    "afterPhotos": ["data:image/jpeg;base64,..."],
    "remark": "整体运行正常",
    "createdBy": "u_xxx",
    "createdByName": "张三",
    "createdAt": "2026-07-04 09:00:00",
    "updatedAt": "2026-07-04 09:00:00"
  }
}
```

### 11.9 创建巡检记录

| 项目 | 说明 |
|------|------|
| 路径 | `POST /api/inspections/records` |
| 认证 | 是 |

**请求体**：

```json
{
  "templateId": "imt_xxx",
  "templateName": "挤压机日常巡检",
  "equipmentId": "e_xxx",
  "equipmentCode": "XJ-PEF1-001",
  "equipmentName": "780T铝型材挤压机",
  "equipmentType": "挤压机",
  "inspectionDate": "2026-07-04",
  "items": [
    { "content": "检查液压系统压力是否正常", "order": 0, "checked": true, "remark": "" },
    { "content": "检查温度传感器是否正常", "order": 1, "checked": false, "remark": "温度偏高" }
  ],
  "photos": ["data:image/jpeg;base64,..."],
  "afterPhotos": ["data:image/jpeg;base64,..."],
  "remark": "整体运行正常"
}
```

### 11.10 更新巡检记录

| 项目 | 说明 |
|------|------|
| 路径 | `PUT /api/inspections/records/:id` |
| 认证 | 是 |

### 11.11 删除巡检记录

| 项目 | 说明 |
|------|------|
| 路径 | `DELETE /api/inspections/records/:id` |
| 认证 | 是 |

### 11.12 导出巡检记录 CSV

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/inspections/export?startDate=xxx&endDate=xxx` |
| 认证 | 是 |
| 响应 | CSV 文件（UTF-8 BOM） |

**导出字段**：记录ID、模板名称、设备编号、设备名称、设备类型、巡检日期、检查结果（通过数/总数）、状态、创建人、创建时间、备注。

---

## 十二、其他接口

### 12.1 健康检查

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/health` |
| 认证 | 否 |

**响应**：

```json
{
  "code": 200,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-01T08:00:00.000Z",
    "version": "1.0.0",
    "environment": "production"
  },
  "message": "服务运行正常"
}
```

### 12.2 扫码查看设备

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/scan/:code` |
| 认证 | 否 |
| 响应 | HTML 页面，显示设备信息和操作入口 |

### 12.3 日志管理

| 项目 | 说明 |
|------|------|
| 路径 | `GET /api/logs?page=1&pageSize=20` |
| 认证 | 是（管理员） |

**响应**：

```json
{
  "code": 200,
  "data": {
    "total": 100,
    "list": [
      {
        "time": "2026-07-01 08:00:00",
        "level": "info",
        "message": "GET /api/health 200"
      }
    ]
  }
}
```

---

## 附录：数据字典

### 角色枚举

| 值 | 说明 |
|----|------|
| employee | 普通员工 |
| manager | 部门经理 |
| admin | 系统管理员 |

### 设备状态枚举

| 值 | 说明 |
|----|------|
| in_use | 在用 |
| stopped | 停用 |
| scrapped | 报废 |

### 记录类型枚举

| 值 | 说明 |
|----|------|
| repair | 维修 |
| maintenance | 保养 |
| inspection | 巡检 |
| improvement | 改善 |

### 记录状态枚举

| 值 | 说明 |
|----|------|
| completed | 已完成 |
| approved | 已审核 |
| pending | 待处理 |

### 保养周期类型

| 值 | 说明 |
|----|------|
| daily | 每天 |
| weekly | 每周 |
| monthly | 每月 |
| quarterly | 每季度 |
| yearly | 每年 |

### 处理结果枚举

| 值 | 说明 |
|----|------|
| fixed | 已修复 |
| observing | 待观察 |
| needs_parts | 需更换配件 |
| unrepairable | 无法修复 |