const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success } = require('../utils/helper');

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res) => {
  const equipments = db.getAll('equipments');
  const records = db.getAll('records');
  const inspectionRecords = db.getAll('inspectionRecords');

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
  let monthlyRepair = 0, monthlyMaintenance = 0, monthlyInspection = 0;
  let pendingRecords = 0, completedRecords = 0;
  let repairHours = 0, repairCount = 0;

  for (const r of records) {
    const isCurrentMonth = (r.createdAt || '').startsWith(currentMonth);
    if (r.type === 'repair') {
      if (isCurrentMonth) monthlyRepair++;
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

  const mttr = repairCount > 0 ? Math.round((repairHours / repairCount) * 10) / 10 : 0;
  const availabilityRate = totalEquipments > 0 ? Math.round((inUseCount / totalEquipments) * 1000) / 10 : 0;

  res.json(success({
    totalEquipments, inUseCount, stoppedCount, scrappedCount,
    monthlyRepairCount: monthlyRepair, monthlyMaintenanceCount: monthlyMaintenance, monthlyInspectionCount: monthlyInspection,
    mttr, availabilityRate, pendingRecords, completedRecords
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

module.exports = router;
