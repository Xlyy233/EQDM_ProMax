const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success } = require('../utils/helper');

const router = express.Router();

router.get('/dashboard', authMiddleware, (req, res) => {
  const equipments = db.getAll('equipments');
  const records = db.getAll('records');

  const totalEquipments = equipments.length;
  const inUseCount = equipments.filter(e => e.status === 'in_use').length;
  const stoppedCount = equipments.filter(e => e.status === 'stopped').length;
  const scrappedCount = equipments.filter(e => e.status === 'scrapped').length;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyRepair = records.filter(r => r.type === 'repair' && (r.createdAt || '').startsWith(currentMonth)).length;
  const monthlyMaintenance = records.filter(r => r.type === 'maintenance' && (r.createdAt || '').startsWith(currentMonth)).length;
  const monthlyInspection = records.filter(r => r.type === 'inspection' && (r.createdAt || '').startsWith(currentMonth)).length;

  const repairRecords = records.filter(r => r.type === 'repair' && r.startTime && r.endTime);
  let mttr = 0;
  if (repairRecords.length > 0) {
    let totalHours = 0;
    for (const r of repairRecords) {
      const diff = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000;
      if (diff > 0) totalHours += diff;
    }
    mttr = Math.round((totalHours / repairRecords.length) * 10) / 10;
  }

  const availabilityRate = totalEquipments > 0 ? Math.round((inUseCount / totalEquipments) * 1000) / 10 : 0;
  const pendingRecords = records.filter(r => r.status === 'pending').length;
  const completedRecords = records.filter(r => r.status === 'completed' || r.status === 'approved').length;

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

  const records = db.getAll('records');
  const monthRecords = records.filter(r => (r.createdAt || '').startsWith(prefix));

  const repair = monthRecords.filter(r => r.type === 'repair').length;
  const maintenance = monthRecords.filter(r => r.type === 'maintenance').length;
  const inspection = monthRecords.filter(r => r.type === 'inspection').length;
  const improvement = monthRecords.filter(r => r.type === 'improvement').length;
  const totalThisMonth = monthRecords.length;
  const monthlyFailureRate = totalThisMonth > 0 ? Math.round((repair / totalThisMonth) * 1000) / 10 : 0;

  const equipments = db.getAll('equipments');
  const equipmentFailureRates = equipments.map(e => {
    const eRecords = records.filter(r => r.equipmentId === e.id && (r.createdAt || '').startsWith(prefix));
    const eRepair = eRecords.filter(r => r.type === 'repair').length;
    const eInspection = eRecords.filter(r => r.type === 'inspection').length;
    const total = eRepair + eInspection;
    return {
      equipmentId: e.id,
      equipmentName: e.name,
      failureRate: total > 0 ? Math.round((eRepair / total) * 1000) / 10 : 0,
      repairCount: eRepair,
      inspectionCount: eInspection
    };
  }).sort((a, b) => b.repairCount - a.repairCount).slice(0, 10);

  const partsMap = {};
  for (const r of monthRecords) {
    if (r.partsReplaced) {
      try {
        const parsed = typeof r.partsReplaced === 'string' ? JSON.parse(r.partsReplaced) : r.partsReplaced;
        if (Array.isArray(parsed)) {
          for (const p of parsed) partsMap[p] = (partsMap[p] || 0) + 1;
        } else if (typeof parsed === 'string' && parsed) {
          partsMap[parsed] = (partsMap[parsed] || 0) + 1;
        }
      } catch (e) {}
    }
  }
  const vulnerableParts = Object.entries(partsMap).map(([partName, replaceCount]) => ({
    partName, replaceCount, equipmentCount: 1, equipmentList: [partName]
  })).sort((a, b) => b.replaceCount - a.replaceCount).slice(0, 5);

  res.json(success({
    monthlyFailureRate,
    monthlyRecords: { repair, maintenance, inspection, improvement },
    equipmentFailureRates,
    vulnerableParts
  }));
});

router.get('/trend', authMiddleware, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const records = db.getAll('records');
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const dayRecords = records.filter(r => (r.createdAt || '').startsWith(date));
    result.push({
      date,
      repair: dayRecords.filter(r => r.type === 'repair').length,
      maintenance: dayRecords.filter(r => r.type === 'maintenance').length,
      inspection: dayRecords.filter(r => r.type === 'inspection').length,
      improvement: dayRecords.filter(r => r.type === 'improvement').length
    });
  }
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
  const departments = [...new Set(equipments.map(e => e.department).filter(Boolean))];

  const result = departments.map(dept => {
    const deptEquipIds = new Set(equipments.filter(e => e.department === dept).map(e => e.id));
    const deptRecords = records.filter(r => deptEquipIds.has(r.equipmentId));
    const repairCount = deptRecords.filter(r => r.type === 'repair').length;
    const maintenanceCount = deptRecords.filter(r => r.type === 'maintenance').length;
    const total = repairCount + maintenanceCount;
    return {
      department: dept,
      equipmentCount: deptEquipIds.size,
      repairCount, maintenanceCount,
      failureRate: total > 0 ? Math.round((repairCount / total) * 1000) / 10 : 0
    };
  });

  res.json(success(result));
});

router.get('/cost', authMiddleware, (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const records = db.getAll('records');
  const totalCost = Math.round(records.reduce((s, r) => s + (Number(r.cost) || 0), 0) * 100) / 100;
  const laborCost = Math.round(records.reduce((s, r) => s + (Number(r.laborCost) || 0), 0) * 100) / 100;
  const partsCost = Math.round(records.reduce((s, r) => s + (Number(r.partsCost) || 0), 0) * 100) / 100;
  const otherCost = Math.round(records.reduce((s, r) => s + (Number(r.otherCost) || 0), 0) * 100) / 100;

  const monthlyCosts = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthRecords = records.filter(r => (r.createdAt || '').startsWith(prefix));
    const sum = monthRecords.reduce((s, r) => s + (Number(r.cost) || 0), 0);
    monthlyCosts.push({ month: prefix, cost: Math.round(sum * 100) / 100 });
  }

  res.json(success({ totalCost, laborCost, partsCost, otherCost, monthlyCosts }));
});

router.get('/record-type-distribution', authMiddleware, (req, res) => {
  const records = db.getAll('records');
  const types = [
    { type: 'repair', name: '维修', color: '#ef4444' },
    { type: 'maintenance', name: '保养', color: '#3b82f6' },
    { type: 'inspection', name: '巡检', color: '#10b981' },
    { type: 'improvement', name: '改善', color: '#f59e0b' }
  ];
  const result = types.map(t => ({
    name: t.name,
    value: records.filter(r => r.type === t.type).length,
    color: t.color
  }));
  res.json(success(result));
});

module.exports = router;
