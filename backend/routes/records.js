const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');
const { createNotification } = require('./notifications');

const router = express.Router();

// 解析记录中的 JSON 字符串字段，并关联设备编号
function parseRecord(record) {
  if (!record) return record
  if (typeof record.photos === 'string' && record.photos) {
    try { record.photos = JSON.parse(record.photos) } catch { record.photos = [] }
  }
  if (!Array.isArray(record.photos)) record.photos = []
  // 关联设备编号
  if (record.equipmentId && !record.equipmentCode) {
    const eq = db.findById('equipments', record.equipmentId)
    if (eq) record.equipmentCode = eq.code
  }
  return record
}

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, type, status, equipmentId, createdBy, startTime, endTime } = req.query;
  let list = db.getAll('records');
  list.forEach(r => parseRecord(r));

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(r =>
      (r.title && r.title.toLowerCase().includes(kw)) ||
      (r.content && r.content.toLowerCase().includes(kw)) ||
      (r.equipmentName && r.equipmentName.toLowerCase().includes(kw))
    );
  }
  if (type) list = list.filter(r => r.type === type);
  if (status) list = list.filter(r => r.status === status);
  if (equipmentId) list = list.filter(r => r.equipmentId === equipmentId);
  if (createdBy) list = list.filter(r => r.createdBy === createdBy);
  if (startTime) list = list.filter(r => r.createdAt >= startTime);
  if (endTime) list = list.filter(r => r.createdAt <= endTime);

  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const result = db.paginate(list, page, pageSize);
  res.json(success(result));
});

router.get('/stats', authMiddleware, (req, res) => {
  const { startTime, endTime } = req.query;
  let list = db.getAll('records');
  list.forEach(r => parseRecord(r));
  if (startTime) list = list.filter(r => r.createdAt >= startTime);
  if (endTime) list = list.filter(r => r.createdAt <= endTime);

  const total = list.length;
  const repair = list.filter(r => r.type === 'repair').length;
  const maintenance = list.filter(r => r.type === 'maintenance').length;
  const inspection = list.filter(r => r.type === 'inspection').length;
  const improvement = list.filter(r => r.type === 'improvement').length;

  res.json(success({ total, repair, maintenance, inspection, improvement }));
});

router.get('/:id', authMiddleware, (req, res) => {
  const record = db.findById('records', req.params.id);
  if (!record) return res.json(error('记录不存在', 404));
  res.json(success(parseRecord(record)));
});

router.post('/', authMiddleware, (req, res) => {
  const { equipmentId, equipmentCode, equipmentName, type, title, content, faultDescription, faultCause, solution, startTime, endTime, result, remark, photos, status, personnel, cost, laborCost, partsCost, otherCost, partsReplaced, partsReplacedDetail, isStopped, stopDuration, stopDurationUnit } = req.body || {};
  if (!equipmentId || !type) return res.json(error('设备ID和类型为必填项'));

  const equip = db.findById('equipments', equipmentId);
  if (!equip) return res.json(error('关联设备不存在'));

  const newRecord = {
    equipmentId,
    equipmentCode: equipmentCode || equip.code,
    equipmentName: equipmentName || equip.name,
    type,
    title: title || '',
    content: content || '',
    faultDescription: faultDescription || '',
    faultCause: faultCause || '',
    solution: solution || '',
    startTime: startTime || '',
    endTime: endTime || '',
    result: result || '',
    remark: remark || '',
    photos: Array.isArray(photos) ? JSON.stringify(photos) : (photos || ''),
    status: status || 'completed',
    personnel: personnel || '',
    cost: cost || 0,
    laborCost: laborCost || 0,
    partsCost: partsCost || 0,
    otherCost: otherCost || 0,
    partsReplaced: partsReplaced || 'no',
    partsReplacedDetail: partsReplacedDetail || '',
    isStopped: isStopped || 'no',
    stopDuration: stopDuration || '',
    stopDurationUnit: stopDurationUnit || 'minutes',
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  const created = db.insert('records', newRecord);

  // 创建通知：为每个用户生成独立副本（排除提交人自己）
  const typeLabel = { repair: '维修', maintenance: '保养', inspection: '巡检', improvement: '改善' }[type] || type;
  const users = db.getAll('users');
  for (const u of users) {
    if (u.id === req.user.id) continue;
    createNotification({
      type: 'new_record',
      title: '新工作记录',
      content: `${req.user.realName || req.user.username} 提交了「${equipmentName || equip.name}」的${typeLabel}记录`,
      targetUrl: `/record/${created.id}`,
      targetUserId: u.id
    });
  }

  res.json(success(created, '记录创建成功'));
});

router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.findById('records', id);
  if (!existing) return res.json(error('记录不存在', 404));

  const updates = {};
  const fields = ['equipmentId', 'equipmentCode', 'equipmentName', 'type', 'title', 'content', 'faultDescription', 'faultCause', 'solution', 'startTime', 'endTime', 'result', 'remark', 'status', 'personnel', 'cost', 'laborCost', 'partsCost', 'otherCost', 'partsReplaced', 'partsReplacedDetail', 'isStopped', 'stopDuration', 'stopDurationUnit'];
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.photos !== undefined) {
    updates.photos = Array.isArray(req.body.photos) ? JSON.stringify(req.body.photos) : (req.body.photos || '');
  }
  updates.updatedBy = req.user.id;

  const updated = db.update('records', id, updates);
  res.json(success(updated, '记录更新成功'));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.remove('records', id);
  if (!result) return res.json(error('记录不存在', 404));
  res.json(success(null, '记录删除成功'));
});

module.exports = router;
