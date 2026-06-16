const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

const CYCLE_DAYS = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, status, equipmentId } = req.query;
  let list = db.getAll('maintenancePlans');

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(p =>
      (p.planName && p.planName.toLowerCase().includes(kw)) ||
      (p.equipmentName && p.equipmentName.toLowerCase().includes(kw)) ||
      (p.equipmentCode && p.equipmentCode.toLowerCase().includes(kw))
    );
  }
  if (status) list = list.filter(p => p.status === status);
  if (equipmentId) list = list.filter(p => p.equipmentId === equipmentId);

  list.sort((a, b) => (a.nextMaintenanceDate || '').localeCompare(b.nextMaintenanceDate || ''));
  const result = db.paginate(list, page, pageSize);
  res.json(success(result));
});

router.get('/upcoming', authMiddleware, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const list = db.getAll('maintenancePlans').filter(p =>
    p.status === 'active' &&
    p.nextMaintenanceDate &&
    p.nextMaintenanceDate <= limit &&
    p.nextMaintenanceDate >= today
  ).sort((a, b) => (a.nextMaintenanceDate || '').localeCompare(b.nextMaintenanceDate || ''));

  res.json(success(list));
});

router.get('/:id', authMiddleware, (req, res) => {
  const plan = db.findById('maintenancePlans', req.params.id);
  if (!plan) return res.json(error('维保计划不存在', 404));
  res.json(success(plan));
});

router.post('/', authMiddleware, (req, res) => {
  const { equipmentId, equipmentName, equipmentCode, planName, cycleType, cycleValue, lastMaintenanceDate, nextMaintenanceDate, responsibleUserId, responsibleUserName, status, remark } = req.body || {};
  if (!equipmentId || !planName) return res.json(error('设备ID和计划名称为必填项'));

  const equip = db.findById('equipments', equipmentId);
  if (!equip) return res.json(error('关联设备不存在'));

  const newPlan = {
    equipmentId,
    equipmentName: equipmentName || equip.name,
    equipmentCode: equipmentCode || equip.code,
    planName,
    cycleType: cycleType || 'monthly',
    cycleValue: cycleValue || 1,
    lastMaintenanceDate: lastMaintenanceDate || '',
    nextMaintenanceDate: nextMaintenanceDate || '',
    responsibleUserId: responsibleUserId || '',
    responsibleUserName: responsibleUserName || '',
    status: status || 'active',
    remark: remark || ''
  };

  const created = db.insert('maintenancePlans', newPlan);
  res.json(success(created, '维保计划创建成功'));
});

router.post('/:id/complete', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.findById('maintenancePlans', id);
  if (!existing) return res.json(error('维保计划不存在', 404));

  const today = new Date().toISOString().slice(0, 10);
  const days = (CYCLE_DAYS[existing.cycleType] || 30) * (existing.cycleValue || 1);
  const next = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const updated = db.update('maintenancePlans', id, {
    lastMaintenanceDate: today,
    nextMaintenanceDate: next
  });
  res.json(success(updated, '维保完成，已自动更新下次日期'));
});

router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.findById('maintenancePlans', id);
  if (!existing) return res.json(error('维保计划不存在', 404));

  const updates = {};
  const fields = ['equipmentId', 'equipmentName', 'equipmentCode', 'planName', 'cycleType', 'cycleValue', 'lastMaintenanceDate', 'nextMaintenanceDate', 'responsibleUserId', 'responsibleUserName', 'status', 'remark'];
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }

  const updated = db.update('maintenancePlans', id, updates);
  res.json(success(updated, '维保计划更新成功'));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.remove('maintenancePlans', id);
  if (!result) return res.json(error('维保计划不存在', 404));
  res.json(success(null, '维保计划删除成功'));
});

module.exports = router;
