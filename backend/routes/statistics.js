const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success } = require('../utils/helper');

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res) => {
  const equipments = db.getAll('equipments');
  const records = db.getAll('records');
  const inspectionRecords = db.getAll('inspectionRecords');
  const plans = db.getAll('maintenancePlans');

  // 单次遍历设备，同时统计所有状态
  let inUseCount = 0, stoppedCount = 0, scrappedCount = 0;
  for (const e of equipments) {
    if (e.status === 'in_use') inUseCount++;
    else if (e.status === 'stopped') stoppedCount++;
    else if (e.status === 'scrapped') scrappedCount++;
  }
  const totalEquipments = equipments.length;

  // 单次遍历记录，同时统计所有指标
  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
  let monthlyRepair = 0, monthlyMaintenance = 0, monthlyInspection = 0;
  let pendingRecords = 0, completedRecords = 0;
  let repairHours = 0, repairCount = 0;
  let totalRepairRecords = 0;

  for (const r of records) {
    const isCurrentMonth = (r.createdAt || '').startsWith(currentMonth);
    if (r.type === 'repair') {
      if (isCurrentMonth) monthlyRepair++;
      totalRepairRecords++;
      if (r.startTime && r.endTime) {
        const diff = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000;
        if (diff > 0) { repairHours += diff; repairCount++; }
      }
    } else if (r.type === 'maintenance' && isCurrentMonth) {
      monthlyMaintenance++;
    } else if (r.type === 'inspection' && isCurrentMonth) {
      monthlyInspection++;
    }
    if (r.status === 'pending') pendingRecords++;
    else if (r.status === 'completed' || r.status === 'approved') completedRecords++;
  }

  // 统计巡检模块的巡检记录
  for (const ir of inspectionRecords) {
    if ((ir.inspectionDate || '').startsWith(currentMonth)) {
      monthlyInspection++;
    }
  }

  // MTTR: 平均修复时间（小时）
  const mttr = repairCount > 0 ? Math.round((repairHours / repairCount) * 10) / 10 : 0;

  // 可用率: 基于维修停机时间计算
  // 总运行时间 = 设备总数 × 30天 × 24小时
  const totalRuntimeHours = totalEquipments * 30 * 24;
  const availabilityRate = totalRuntimeHours > 0
    ? Math.round(((totalRuntimeHours - repairHours) / totalRuntimeHours) * 1000) / 10
    : 100;

  // MTBF: 平均故障间隔（天）
  // 总运行天数 = 设备总数 × 30天
  const totalDays = totalEquipments * 30;
  const mtbf = totalRepairRecords > 0 ? Math.round((totalDays / totalRepairRecords) * 10) / 10 : totalDays;

  // 保养执行率: 本月已完成保养计划 / 本月应执行计划
  let plannedThisMonth = 0, completedThisMonth = 0;
  for (const p of plans) {
    const nextDate = p.nextMaintenanceDate || '';
    if (nextDate.startsWith(currentMonth)) {
      plannedThisMonth++;
      if (p.status === 'completed') completedThisMonth++;
    }
  }
  const maintenanceRate = plannedThisMonth > 0
    ? Math.round((completedThisMonth / plannedThisMonth) * 1000) / 10
    : 0;

  // 环比：上月维修次数
  let lastMonthRepair = 0;
  for (const r of records) {
    if (r.type === 'repair' && (r.createdAt || '').startsWith(lastMonth)) {
      lastMonthRepair++;
    }
  }

  res.json(success({
    totalEquipments, inUseCount, stoppedCount, scrappedCount,
    monthlyRepairCount: monthlyRepair, monthlyMaintenanceCount: monthlyMaintenance, monthlyInspectionCount: monthlyInspection,
    mttr, mtbf, availabilityRate, maintenanceRate,
    pendingRecords, completedRecords,
    lastMonthRepairCount: lastMonthRepair,
    lowStockParts: (db.getAll('spareParts') || []).filter(s => s.quantity <= s.minStock).map(s => ({
      id: s.id, name: s.name, spec: s.spec, quantity: s.quantity, minStock: s.minStock, unit: s.unit
    }))
  }));
});

router.get('/monthly', authMiddleware, (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  // 设备名称索引
  const equipments = db.getAll('equipments');
  const eqNameMap = {};
  for (const e of equipments) {
    eqNameMap[e.id] = e.name;
  }

  // 单次遍历记录：同时统计类型、按设备分组、采集配件
  const records = db.getAll('records');
  let repair = 0, maintenance = 0, inspection = 0, improvement = 0;
  const eqStats = {};
  const partsMap = {};

  for (const r of records) {
    if (!(r.createdAt || '').startsWith(prefix)) continue;

    if (r.type === 'repair') repair++;
    else if (r.type === 'maintenance') maintenance++;
    else if (r.type === 'inspection') inspection++;
    else if (r.type === 'improvement') improvement++;

    if (r.equipmentId) {
      if (!eqStats[r.equipmentId]) eqStats[r.equipmentId] = { repair: 0, inspection: 0 };
      if (r.type === 'repair') eqStats[r.equipmentId].repair++;
      else if (r.type === 'inspection') eqStats[r.equipmentId].inspection++;
    }

    if (r.partsReplaced === 'yes' && r.partsReplacedDetail) {
      const detail = r.partsReplacedDetail.trim();
      if (detail) {
        const items = detail.split(/[,，、;；\n]+/).map(s => s.trim()).filter(Boolean);
        for (const item of items) {
          partsMap[item] = (partsMap[item] || 0) + 1;
        }
      }
    }
  }

  const totalThisMonth = repair + maintenance + inspection + improvement;
  const monthlyFailureRate = totalThisMonth > 0 ? Math.round((repair / totalThisMonth) * 1000) / 10 : 0;

  const equipmentFailureRates = Object.entries(eqStats)
    .map(([id, stats]) => {
      const total = stats.repair + stats.inspection;
      return {
        equipmentId: id,
        equipmentName: eqNameMap[id] || '',
        failureRate: total > 0 ? Math.round((stats.repair / total) * 1000) / 10 : 0,
        repairCount: stats.repair,
        inspectionCount: stats.inspection
      };
    })
    .sort((a, b) => b.repairCount - a.repairCount)
    .slice(0, 10);

  const vulnerableParts = Object.entries(partsMap)
    .map(([partName, replaceCount]) => ({
      partName, replaceCount, equipmentCount: 1, equipmentList: [partName]
    }))
    .sort((a, b) => b.replaceCount - a.replaceCount)
    .slice(0, 5);

  res.json(success({
    monthlyFailureRate,
    monthlyRecords: { repair, maintenance, inspection, improvement },
    equipmentFailureRates,
    vulnerableParts
  }));
});

router.get('/trend', authMiddleware, (req, res) => {
  const days = parseInt(req.query.days) || 30;

  // 生成日期列表（最近 N 天）
  const dateList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dateList.push(d.toISOString().slice(0, 10));
  }

  // 单次遍历记录，按日期分组统计
  const dateMap = {};
  for (const d of dateList) {
    dateMap[d] = { repair: 0, maintenance: 0, inspection: 0, improvement: 0 };
  }

  const records = db.getAll('records');
  for (const r of records) {
    const date = (r.createdAt || '').slice(0, 10);
    if (dateMap[date]) {
      if (r.type === 'repair') dateMap[date].repair++;
      else if (r.type === 'maintenance') dateMap[date].maintenance++;
      else if (r.type === 'inspection') dateMap[date].inspection++;
      else if (r.type === 'improvement') dateMap[date].improvement++;
    }
  }

  const result = dateList.map(date => ({ date, ...dateMap[date] }));
  res.json(success(result));
});

router.get('/equipment-kpi/:equipmentId', authMiddleware, (req, res) => {
  const { equipmentId } = req.params;
  const equip = db.findById('equipments', equipmentId);
  if (!equip) return res.json({ code: 404, data: null, message: '设备不存在' });

  const records = db.getAll('records').filter(r => r.equipmentId === equipmentId);
  const repairRecords = records.filter(r => r.type === 'repair' && r.startTime && r.endTime);

  let totalRepairCost = 0;
  let totalRepairHours = 0;
  for (const r of repairRecords) {
    totalRepairCost += Number(r.cost) || 0;
    const diff = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000;
    if (diff > 0) totalRepairHours += diff;
  }

  const mttr = repairRecords.length > 0 ? Math.round((totalRepairHours / repairRecords.length) * 10) / 10 : 0;
  const repairCount = records.filter(r => r.type === 'repair').length;
  const maintenanceCount = records.filter(r => r.type === 'maintenance').length;
  const daysSince = Math.max(1, Math.floor((Date.now() - new Date(equip.createdAt || Date.now()).getTime()) / 86400000));
  const mtbf = repairCount > 0 ? Math.round((daysSince / repairCount) * 10) / 10 : daysSince;
  const totalHours = daysSince * 24;
  const availabilityRate = totalHours > 0 ? Math.round(((totalHours - totalRepairHours) / totalHours) * 1000) / 10 : 100;

  res.json(success({
    equipmentId,
    equipmentName: equip.name,
    mtbf, mttr, availabilityRate,
    totalRepairCost: Math.round(totalRepairCost * 100) / 100,
    repairCount, maintenanceCount
  }));
});

router.get('/department', authMiddleware, (req, res) => {
  const equipments = db.getAll('equipments');
  const records = db.getAll('records');

  // 部门→设备ID集合
  const deptEquipIds = {};
  const deptEquipCount = {};
  for (const e of equipments) {
    const dept = e.department || '未分类';
    if (!deptEquipIds[dept]) {
      deptEquipIds[dept] = new Set();
      deptEquipCount[dept] = 0;
    }
    deptEquipIds[dept].add(e.id);
    deptEquipCount[dept]++;
  }

  // 单次遍历记录，按部门分组统计
  const deptStats = {};
  for (const dept of Object.keys(deptEquipIds)) {
    deptStats[dept] = { repair: 0, maintenance: 0 };
  }
  for (const r of records) {
    if (!r.equipmentId) continue;
    for (const dept of Object.keys(deptEquipIds)) {
      if (deptEquipIds[dept].has(r.equipmentId)) {
        if (r.type === 'repair') deptStats[dept].repair++;
        else if (r.type === 'maintenance') deptStats[dept].maintenance++;
        break;
      }
    }
  }

  const result = Object.keys(deptEquipIds).map(dept => {
    const stats = deptStats[dept];
    const total = stats.repair + stats.maintenance;
    return {
      department: dept,
      equipmentCount: deptEquipCount[dept],
      repairCount: stats.repair,
      maintenanceCount: stats.maintenance,
      failureRate: total > 0 ? Math.round((stats.repair / total) * 1000) / 10 : 0
    };
  });

  res.json(success(result));
});

router.get('/cost', authMiddleware, (req, res) => {
  const months = parseInt(req.query.months) || 6;

  // 生成月份前缀列表
  const monthPrefixes = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthPrefixes.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 单次遍历记录：同时统计总费用和按月分组
  const records = db.getAll('records');
  let totalCost = 0, laborCost = 0, partsCost = 0, otherCost = 0;
  const monthMap = {};
  for (const p of monthPrefixes) {
    monthMap[p] = 0;
  }

  for (const r of records) {
    totalCost += Number(r.cost) || 0;
    laborCost += Number(r.laborCost) || 0;
    partsCost += Number(r.partsCost) || 0;
    otherCost += Number(r.otherCost) || 0;

    const prefix = (r.createdAt || '').slice(0, 7);
    if (monthMap[prefix] !== undefined) {
      monthMap[prefix] += Number(r.cost) || 0;
    }
  }

  const monthlyCosts = monthPrefixes.map(p => ({
    month: p,
    cost: Math.round(monthMap[p] * 100) / 100
  }));

  res.json(success({
    totalCost: Math.round(totalCost * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    partsCost: Math.round(partsCost * 100) / 100,
    otherCost: Math.round(otherCost * 100) / 100,
    monthlyCosts
  }));
});

router.get('/record-type-distribution', authMiddleware, (req, res) => {
  const records = db.getAll('records');

  // 单次遍历统计四种类型
  let repair = 0, maintenance = 0, inspection = 0, improvement = 0;
  for (const r of records) {
    if (r.type === 'repair') repair++;
    else if (r.type === 'maintenance') maintenance++;
    else if (r.type === 'inspection') inspection++;
    else if (r.type === 'improvement') improvement++;
  }

  const result = [
    { name: '维修', value: repair, color: '#ef4444' },
    { name: '保养', value: maintenance, color: '#3b82f6' },
    { name: '巡检', value: inspection, color: '#10b981' },
    { name: '改善', value: improvement, color: '#f59e0b' }
  ];
  res.json(success(result));
});

// 配件更换汇总统计
router.get('/parts-replacement', authMiddleware, (req, res) => {
  const records = db.getAll('records');
  const replacedRecords = records.filter(r => r.partsReplaced === 'yes' && r.partsReplacedDetail);

  // 配件更换记录列表
  const partsList = replacedRecords.map(r => ({
    equipmentName: r.equipmentName || '',
    equipmentId: r.equipmentId,
    detail: r.partsReplacedDetail,
    date: (r.createdAt || '').slice(0, 10),
    type: r.type
  })).sort((a, b) => b.date.localeCompare(a.date));

  // 配件关键词统计
  const partsMap = {};
  for (const r of replacedRecords) {
    const detail = r.partsReplacedDetail.trim();
    if (detail) {
      const items = detail.split(/[,，、;；\n]+/).map(s => s.trim()).filter(Boolean);
      for (const item of items) {
        partsMap[item] = (partsMap[item] || 0) + 1;
      }
    }
  }

  const partsStats = Object.entries(partsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const perEquipment = replacedRecords.reduce((acc, r) => {
    const key = r.equipmentName || r.equipmentId;
    if (!acc[key]) acc[key] = { name: key, count: 0, details: [] };
    acc[key].count += 1;
    acc[key].details.push(r.partsReplacedDetail);
    return acc;
  }, {});

  const equipmentStats = Object.values(perEquipment)
    .sort((a, b) => b.count - a.count);

  res.json(success({
    totalReplacements: replacedRecords.length,
    partsList: partsList.slice(0, 50),
    partsStats,
    equipmentStats
  }));
});

// ========== 预测性分析 ==========

router.get('/predictive', authMiddleware, (req, res) => {
  const equipments = db.getAll('equipments');
  const records = db.getAll('records');
  const inspectionRecords = db.getAll('inspectionRecords');
  const plans = db.getAll('maintenancePlans');

  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 7);
  const currentMonth = now.toISOString().slice(0, 7);
  const eqNameMap = {};
  for (const e of equipments) eqNameMap[e.id] = e.name;

  // 设备创建日期索引（用于计算设备年龄）
  const eqCreatedMap = {};
  for (const e of equipments) eqCreatedMap[e.id] = e.createdAt || '';

  // ====== 构建月度列表（近6个月）======
  const monthList = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthList.push(d.toISOString().slice(0, 7));
  }

  // ====== 按设备分组统计 ======
  const eqStats = {}; // { equipmentId: { repairCounts: {month: count}, totalRepair: N, inspectionItems: {failCount, totalCount}, partsCount: N } }
  const initEqStats = () => {
    const monthly = {};
    for (const m of monthList) monthly[m] = 0;
    return { repairCounts: monthly, totalRepair: 0, inspectionFailCount: 0, inspectionTotalCount: 0, partsCount: 0 };
  };

  // 维修记录统计
  for (const r of records) {
    if (r.type !== 'repair') continue;
    const eid = r.equipmentId;
    if (!eid) continue;
    if (!eqStats[eid]) eqStats[eid] = initEqStats();
    eqStats[eid].totalRepair++;
    const m = (r.createdAt || '').slice(0, 7);
    if (eqStats[eid].repairCounts[m] !== undefined) eqStats[eid].repairCounts[m]++;
    if (r.partsReplaced === 'yes') eqStats[eid].partsCount++;
  }

  // 巡检记录统计
  for (const ir of inspectionRecords) {
    const eid = ir.equipmentId;
    if (!eid) continue;
    if (!eqStats[eid]) eqStats[eid] = initEqStats();
    const items = ir.items || [];
    for (const it of items) {
      eqStats[eid].inspectionTotalCount++;
      if (!it.checked) eqStats[eid].inspectionFailCount++;
    }
  }

  // 巡检异常项目统计（按设备+项目内容）
  const failItemMap = {};
  for (const ir of inspectionRecords) {
    const eid = ir.equipmentId;
    if (!eid) continue;
    const items = ir.items || [];
    for (const it of items) {
      if (!it.checked) {
        if (!failItemMap[eid]) failItemMap[eid] = {};
        const key = it.content;
        failItemMap[eid][key] = (failItemMap[eid][key] || 0) + 1;
      }
    }
  }

  // ====== 保养分析 ======
  const activePlans = plans.filter(p => p.status === 'active');
  const eqPlanMap = {};
  for (const p of activePlans) {
    if (!eqPlanMap[p.equipmentId]) eqPlanMap[p.equipmentId] = [];
    eqPlanMap[p.equipmentId].push(p);
  }

  // 保养逾期和即将到期
  const overduePlans = [];
  const upcomingPlans = [];
  for (const p of activePlans) {
    const diffDays = Math.floor((new Date(p.nextMaintenanceDate).getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) {
      overduePlans.push({ ...p, overdueDays: Math.abs(diffDays) });
    } else if (diffDays <= 7) {
      upcomingPlans.push({ ...p, daysUntil: diffDays });
    }
  }

  // 保养执行率：按设备统计保养记录（从 records 中 type === 'maintenance' 的记录）
  const eqMaintenanceCount = {};
  for (const r of records) {
    if (r.type !== 'maintenance') continue;
    const eid = r.equipmentId;
    if (!eid) continue;
    eqMaintenanceCount[eid] = (eqMaintenanceCount[eid] || 0) + 1;
    const m = (r.createdAt || '').slice(0, 7);
    if (eqStats[eid] && eqStats[eid].repairCounts[m] === undefined) {
      // ensure stats exist
    }
  }

  // 保养后故障分析：某设备保养后 N 天内发生维修
  const ineffectiveMaintenances = [];
  const maintenanceRecords = records.filter(r => r.type === 'maintenance' && r.equipmentId);
  for (const mr of maintenanceRecords) {
    const mDate = new Date(mr.createdAt);
    let repairAfterCount = 0;
    let minDaysToRepair = Infinity;
    for (const r of records) {
      if (r.type !== 'repair' || r.equipmentId !== mr.equipmentId) continue;
      const rDate = new Date(r.createdAt);
      const diff = (rDate.getTime() - mDate.getTime()) / 86400000;
      if (diff > 0 && diff <= 30) {
        repairAfterCount++;
        if (diff < minDaysToRepair) minDaysToRepair = diff;
      }
    }
    if (repairAfterCount > 0) {
      ineffectiveMaintenances.push({
        equipmentId: mr.equipmentId,
        equipmentName: eqNameMap[mr.equipmentId] || '',
        maintenanceDate: mr.createdAt?.slice(0, 10) || '',
        repairAfterCount,
        minDaysToRepair: Math.round(minDaysToRepair)
      });
    }
  }

  // ====== 设备健康评分 ======
  const healthScores = [];
  const highRiskEquipments = [];
  const repairTrends = [];

  for (const e of equipments) {
    const st = eqStats[e.id] || initEqStats();
    const ageDays = e.createdAt ? Math.floor((now.getTime() - new Date(e.createdAt).getTime()) / 86400000) : 0;

    // 维修频率评分 (0-25)
    const repairScore = Math.max(0, 25 - st.totalRepair * 5);

    // 巡检通过率评分 (0-20)
    const failRate = st.inspectionTotalCount > 0 ? st.inspectionFailCount / st.inspectionTotalCount : 0;
    const inspectionScore = Math.round((1 - failRate) * 20);

    // 设备年龄评分 (0-10)
    const ageScore = Math.max(0, 10 - Math.floor(ageDays / 365) * 2);

    // 配件更换评分 (0-15)
    const partsScore = Math.max(0, 15 - st.partsCount * 3);

    // 保养执行率评分 (0-15)
    const plannedCount = (eqPlanMap[e.id] || []).length;
    const actualCount = eqMaintenanceCount[e.id] || 0;
    const complianceRate = plannedCount > 0 ? actualCount / plannedCount : 1;
    const maintenanceScore = Math.round(complianceRate * 15);

    // 保养逾期评分 (0-15)
    const eqOverdue = overduePlans.filter(p => p.equipmentId === e.id);
    const maxOverdue = eqOverdue.length > 0 ? Math.max(...eqOverdue.map(p => p.overdueDays)) : 0;
    const overdueScore = Math.max(0, 15 - Math.floor(maxOverdue / 3));

    const score = repairScore + inspectionScore + ageScore + partsScore + maintenanceScore + overdueScore;
    let riskLevel = 'low';
    if (score < 40) riskLevel = 'high';
    else if (score < 70) riskLevel = 'medium';

    // 维修趋势
    const monthlyCounts = monthList.map(m => st.repairCounts[m] || 0);
    let trend = 'stable';
    if (monthlyCounts.length >= 3) {
      const recent = monthlyCounts.slice(-3);
      if (recent[2] > recent[1] && recent[1] > recent[0]) trend = 'up';
      else if (recent[2] < recent[1] && recent[1] < recent[0]) trend = 'down';
    }

    const item = {
      equipmentId: e.id,
      equipmentName: e.name,
      equipmentCode: e.code,
      score,
      riskLevel,
      repairCount: st.totalRepair,
      inspectionFailRate: Math.round(failRate * 100),
      ageDays,
      partsCount: st.partsCount,
      maintenanceCompliance: Math.round(complianceRate * 100),
      maintenanceOverdue: maxOverdue
    };
    healthScores.push(item);

    if (riskLevel === 'high' || riskLevel === 'medium') {
      const topFailItems = Object.entries(failItemMap[e.id] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v}次)`);
      highRiskEquipments.push({ ...item, repairTrend: trend, topFailItems });
    }

    if (st.totalRepair > 0) {
      repairTrends.push({ equipmentId: e.id, equipmentName: e.name, monthly: monthlyCounts, trend });
    }
  }

  // 排序
  healthScores.sort((a, b) => a.score - b.score);
  highRiskEquipments.sort((a, b) => a.score - b.score);
  repairTrends.sort((a, b) => {
    const aSum = a.monthly.reduce((s, v) => s + v, 0);
    const bSum = b.monthly.reduce((s, v) => s + v, 0);
    return bSum - aSum;
  });

  // 保养逾期排序
  overduePlans.sort((a, b) => b.overdueDays - a.overdueDays);

  // 保养周期建议
  const cycleSuggestions = [];
  for (const e of equipments) {
    const st = eqStats[e.id];
    if (!st || st.totalRepair === 0) continue;
    const plans = eqPlanMap[e.id] || [];
    if (plans.length === 0) continue;
    // 计算平均故障间隔（天）
    const repairDates = records
      .filter(r => r.type === 'repair' && r.equipmentId === e.id)
      .map(r => new Date(r.createdAt).getTime())
      .sort((a, b) => a - b);
    if (repairDates.length >= 2) {
      let totalGap = 0;
      for (let i = 1; i < repairDates.length; i++) totalGap += (repairDates[i] - repairDates[i - 1]) / 86400000;
      const avgGap = Math.round(totalGap / (repairDates.length - 1));
      for (const p of plans) {
        let cycleDays = 30;
        if (p.cycleType === 'daily') cycleDays = p.cycleValue;
        else if (p.cycleType === 'weekly') cycleDays = p.cycleValue * 7;
        else if (p.cycleType === 'monthly') cycleDays = p.cycleValue * 30;
        else if (p.cycleType === 'yearly') cycleDays = p.cycleValue * 365;
        if (avgGap < cycleDays * 0.6) {
          cycleSuggestions.push({
            equipmentId: e.id,
            equipmentName: e.name,
            planName: p.planName,
            currentCycleDays: cycleDays,
            suggestedCycleDays: Math.max(7, Math.round(avgGap)),
            avgRepairGapDays: avgGap
          });
        }
      }
    }
  }

  // ====== 配件更换预测 ======
  const partsHistory = {};
  const replacedRecords = records.filter(r => r.partsReplaced === 'yes' && r.partsReplacedDetail);
  for (const r of replacedRecords) {
    const detail = r.partsReplacedDetail.trim();
    if (!detail) continue;
    const items = detail.split(/[,，、;；\n]+/).map(s => s.trim()).filter(Boolean);
    const date = (r.createdAt || '').slice(0, 10);
    for (const item of items) {
      if (!partsHistory[item]) partsHistory[item] = [];
      partsHistory[item].push(date);
    }
  }
  const partsPredictions = [];
  for (const [name, dates] of Object.entries(partsHistory)) {
    if (dates.length < 2) continue;
    dates.sort();
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGap += (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000;
    }
    const avgCycle = Math.round(totalGap / (dates.length - 1));
    const lastDate = dates[dates.length - 1];
    const predicted = new Date(new Date(lastDate).getTime() + avgCycle * 86400000).toISOString().slice(0, 10);
    const daysUntil = Math.floor((new Date(predicted).getTime() - now.getTime()) / 86400000);
    let priority = 'low';
    if (daysUntil <= 14) priority = 'high';
    else if (daysUntil <= 30) priority = 'medium';
    partsPredictions.push({ partName: name, avgCycleDays: avgCycle, lastReplaceDate: lastDate, predictedNext: predicted, daysUntil, priority });
  }
  partsPredictions.sort((a, b) => a.daysUntil - b.daysUntil);

  // ====== 生成建议 ======
  const suggestions = [];
  // 逾期保养建议
  for (const p of overduePlans.slice(0, 10)) {
    const eq = equipments.find(e => e.id === p.equipmentId);
    const eqSt = eqStats[p.equipmentId];
    const repairInfo = eqSt && eqSt.totalRepair > 0 ? `，该设备本月已发生 ${eqSt.totalRepair} 次维修` : '';
    suggestions.push({
      type: 'urgent',
      title: '保养逾期',
      content: `设备 ${eqNameMap[p.equipmentId] || ''} 的保养计划「${p.planName}」已逾期 ${p.overdueDays} 天${repairInfo}，建议立即安排保养`,
      equipmentId: p.equipmentId,
      equipmentName: eqNameMap[p.equipmentId] || ''
    });
  }
  // 即将到期保养建议
  for (const p of upcomingPlans.slice(0, 5)) {
    suggestions.push({
      type: 'warning',
      title: '保养即将到期',
      content: `设备 ${eqNameMap[p.equipmentId] || ''} 的保养计划「${p.planName}」将于 ${p.daysUntil} 天后到期`,
      equipmentId: p.equipmentId,
      equipmentName: eqNameMap[p.equipmentId] || ''
    });
  }
  // 高风险设备建议
  for (const eq of highRiskEquipments.slice(0, 5)) {
    const parts = [];
    if (eq.repairCount > 0) parts.push(`近 6 月维修 ${eq.repairCount} 次`);
    if (eq.inspectionFailRate > 0) parts.push(`巡检不通过率 ${eq.inspectionFailRate}%`);
    if (eq.maintenanceOverdue > 0) parts.push(`保养逾期 ${eq.maintenanceOverdue} 天`);
    suggestions.push({
      type: 'danger',
      title: '高风险设备',
      content: `设备 ${eq.equipmentName} 健康评分 ${eq.score} 分（${eq.riskLevel === 'high' ? '高风险' : '中风险'}），${parts.join('，')}，建议安排全面检查`,
      equipmentId: eq.equipmentId,
      equipmentName: eq.equipmentName
    });
  }
  // 周期调整建议
  for (const cs of cycleSuggestions.slice(0, 5)) {
    suggestions.push({
      type: 'info',
      title: '保养周期建议',
      content: `设备 ${cs.equipmentName} 的「${cs.planName}」当前周期 ${cs.currentCycleDays} 天，但平均故障间隔仅 ${cs.avgRepairGapDays} 天，建议调整为 ${cs.suggestedCycleDays} 天`,
      equipmentId: cs.equipmentId,
      equipmentName: cs.equipmentName
    });
  }
  // 配件更换建议
  for (const pp of partsPredictions.filter(p => p.priority === 'high').slice(0, 5)) {
    suggestions.push({
      type: 'warning',
      title: '配件更换预警',
      content: `配件「${pp.partName}」预计 ${pp.daysUntil} 天后需要更换（${pp.predictedNext}），建议提前备货`,
      equipmentId: '',
      equipmentName: ''
    });
  }
  suggestions.sort((a, b) => {
    const order = { urgent: 0, danger: 1, warning: 2, info: 3 };
    return (order[a.type] || 4) - (order[b.type] || 4);
  });

  res.json(success({
    healthScores: healthScores.slice(0, 50),
    highRiskEquipments: highRiskEquipments.slice(0, 20),
    repairTrends: repairTrends.slice(0, 10),
    maintenanceAnalysis: {
      complianceRate: activePlans.length > 0
        ? Math.round((Object.values(eqMaintenanceCount).reduce((a, b) => a + b, 0) / activePlans.length) * 100)
        : 0,
      overduePlans: overduePlans.slice(0, 20),
      upcomingPlans: upcomingPlans.slice(0, 10),
      ineffectiveMaintenances: ineffectiveMaintenances.slice(0, 10),
      cycleSuggestions: cycleSuggestions.slice(0, 10)
    },
    partsPredictions: partsPredictions.slice(0, 20),
    suggestions
  }));
});

module.exports = router;
