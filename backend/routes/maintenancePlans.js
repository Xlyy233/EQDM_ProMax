const express = require('express');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

const CYCLE_DAYS = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

// 判断当前用户是否是指定负责人（兼容旧数据 responsibleUserId 和新数据 responsibleUserIds）
function isResponsible(plan, userId) {
  if (plan.responsibleUserIds && Array.isArray(plan.responsibleUserIds)) {
    return plan.responsibleUserIds.includes(userId);
  }
  // 兼容旧数据：单字段 responsibleUserId
  return plan.responsibleUserId === userId;
}

// 判断用户是否为经理或管理员
function isManager(req) {
  return req.user && (req.user.role === 'admin' || req.user.role === 'manager');
}

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, status, equipmentId } = req.query;
  let list = db.getAll('maintenancePlans');

  // 权限过滤：普通员工只能看到自己负责的计划
  if (!isManager(req)) {
    list = list.filter(p => isResponsible(p, req.user.id));
  }

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

  let list = db.getAll('maintenancePlans').filter(p =>
    p.status === 'active' &&
    p.nextMaintenanceDate &&
    p.nextMaintenanceDate <= limit &&
    p.nextMaintenanceDate >= today
  );

  // 权限过滤：普通员工只能看到自己负责的计划
  if (!isManager(req)) {
    list = list.filter(p => isResponsible(p, req.user.id));
  }

  list.sort((a, b) => (a.nextMaintenanceDate || '').localeCompare(b.nextMaintenanceDate || ''));
  res.json(success(list));
});

router.get('/:id', authMiddleware, (req, res) => {
  const plan = db.findById('maintenancePlans', req.params.id);
  if (!plan) return res.json(error('维保计划不存在', 404));
  // 普通员工只能查看自己负责的计划
  if (!isManager(req) && !isResponsible(plan, req.user.id)) {
    return res.status(403).json(error('无权查看此计划'));
  }
  res.json(success(plan));
});

router.post('/', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { equipmentId, equipmentName, equipmentCode, planName, cycleType, cycleValue, lastMaintenanceDate, nextMaintenanceDate, responsibleUserIds, responsibleUserNames, status, remark } = req.body || {};
  if (!equipmentId || !planName) return res.json(error('设备ID和计划名称为必填项'));

  const equip = db.findById('equipments', equipmentId);
  if (!equip) return res.json(error('关联设备不存在'));

  // 兼容多选：responsibleUserIds 为数组，responsibleUserNames 为数组
  const ids = Array.isArray(responsibleUserIds) ? [...new Set(responsibleUserIds)] : (responsibleUserIds ? [responsibleUserIds] : []);
  const names = Array.isArray(responsibleUserNames) ? [...new Set(responsibleUserNames)] : (responsibleUserNames ? [responsibleUserNames] : []);

  const newPlan = {
    equipmentId,
    equipmentName: equipmentName || equip.name,
    equipmentCode: equipmentCode || equip.code,
    planName,
    cycleType: CYCLE_DAYS[cycleType] ? cycleType : 'monthly',
    cycleValue: cycleValue || 1,
    lastMaintenanceDate: lastMaintenanceDate || '',
    nextMaintenanceDate: nextMaintenanceDate || '',
    responsibleUserIds: ids,
    responsibleUserNames: names,
    status: status || 'active',
    remark: remark || ''
  };

  const created = db.insert('maintenancePlans', newPlan);
  res.json(success(created, '维保计划创建成功'));
});

router.post('/:id/complete', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { id } = req.params;
  const existing = db.findById('maintenancePlans', id);
  if (!existing) return res.json(error('维保计划不存在', 404));

  const today = new Date().toISOString().slice(0, 10);
  const days = (CYCLE_DAYS[existing.cycleType] || 30) * (existing.cycleValue || 1);
  const next = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const updated = db.update('maintenancePlans', id, {
    lastMaintenanceDate: today,
    nextMaintenanceDate: next,
    status: 'completed'
  });

  // 自动生成工作记录
  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const record = {
    equipmentId: existing.equipmentId,
    equipmentName: existing.equipmentName || '',
    equipmentCode: existing.equipmentCode || '',
    type: 'maintenance',
    title: `[保养] ${existing.planName}`,
    content: `执行保养计划「${existing.planName}」，周期：${existing.cycleType}，负责人：${(existing.responsibleUserNames || []).join('、') || '-'}`,
    status: 'completed',
    userId: req.user.id,
    userName: req.user.realName || req.user.username,
    startTime: today + ' 00:00:00',
    endTime: today + ' 23:59:59',
    result: '已修复',
    isDowntime: false,
    hasPartReplacement: false,
    photos: [],
    afterPhotos: [],
    consumedParts: [],
    createdAt: now,
    updatedAt: now
  };
  const createdRecord = db.insert('records', record);

  res.json(success({ plan: updated, record: createdRecord }, '维保完成，已自动生成工作记录'));
});

router.put('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { id } = req.params;
  const existing = db.findById('maintenancePlans', id);
  if (!existing) return res.json(error('维保计划不存在', 404));

  const updates = {};
  const fields = ['equipmentId', 'equipmentName', 'equipmentCode', 'planName', 'cycleType', 'cycleValue', 'lastMaintenanceDate', 'nextMaintenanceDate', 'status', 'remark'];
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  // 校验 cycleType 合法性
  if (updates.cycleType !== undefined && !CYCLE_DAYS[updates.cycleType]) {
    return res.json(error('无效的周期类型'));
  }
  // 负责人多选数组（去重）
  if (req.body.responsibleUserIds !== undefined) {
    updates.responsibleUserIds = Array.isArray(req.body.responsibleUserIds) ? [...new Set(req.body.responsibleUserIds)] : [req.body.responsibleUserIds];
  }
  if (req.body.responsibleUserNames !== undefined) {
    updates.responsibleUserNames = Array.isArray(req.body.responsibleUserNames) ? [...new Set(req.body.responsibleUserNames)] : [req.body.responsibleUserNames];
  }

  const updated = db.update('maintenancePlans', id, updates);
  res.json(success(updated, '维保计划更新成功'));
});

router.delete('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { id } = req.params;
  const result = db.remove('maintenancePlans', id);
  if (!result) return res.json(error('维保计划不存在', 404));
  res.json(success(null, '维保计划删除成功'));
});

module.exports = router;
