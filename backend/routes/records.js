const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');
const { createNotification } = require('./notifications');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 照片上传存储配置
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'records');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// 照片上传接口
router.post('/upload-photo', authMiddleware, uploadPhoto.single('file'), (req, res) => {
  if (!req.file) return res.json(error('请选择文件'));
  res.json(success({ fileName: req.file.filename }, '上传成功'));
});

// 备件校验（只读，不写盘）
function validateSpareParts(consumedParts) {
  if (!Array.isArray(consumedParts) || consumedParts.length === 0) return [];
  const warnings = [];
  for (const item of consumedParts) {
    const part = db.findById('spareParts', item.sparePartId);
    if (!part) {
      warnings.push(`备件「${item.sparePartName}」不存在，已跳过`);
      continue;
    }
    if (part.quantity < item.quantity) {
      warnings.push(`备件「${item.sparePartName}」库存不足（当前${part.quantity}，需消耗${item.quantity}），已跳过`);
      continue;
    }
  }
  return warnings;
}

// 备件出库扣减（写盘操作，应异步执行）
function consumeSpareParts(consumedParts) {
  if (!Array.isArray(consumedParts) || consumedParts.length === 0) return { success: true, warnings: [] };
  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const warnings = [];
  const partUpdates = [];
  const logs = [];
  for (const item of consumedParts) {
    const part = db.findById('spareParts', item.sparePartId);
    if (!part) {
      warnings.push(`备件「${item.sparePartName}」不存在，已跳过`);
      continue;
    }
    if (part.quantity < item.quantity) {
      warnings.push(`备件「${item.sparePartName}」库存不足（当前${part.quantity}，需消耗${item.quantity}），已跳过`);
      continue;
    }
    partUpdates.push({ id: item.sparePartId, quantity: part.quantity - item.quantity });
    logs.push({
      sparePartId: item.sparePartId,
      sparePartName: item.sparePartName || part.name,
      type: 'stock-out',
      amount: item.quantity,
      beforeQuantity: part.quantity,
      afterQuantity: part.quantity - item.quantity,
      operatorId: 'system',
      operatorName: '记录消耗',
      remark: '工作记录配件消耗',
      createdAt: now
    });
  }
  // 批量更新备件库存
  if (partUpdates.length > 0) {
    const allParts = db.getAll('spareParts');
    for (const up of partUpdates) {
      const idx = allParts.findIndex(p => p.id === up.id);
      if (idx >= 0) {
        allParts[idx] = { ...allParts[idx], quantity: up.quantity, updatedAt: now };
      }
    }
    db.setAll('spareParts', allParts);
  }
  // 批量写入出库日志
  if (logs.length > 0) {
    db.batchInsert('sparePartLogs', logs);
  }
  return { success: warnings.length === 0, warnings };
}

// 还原备件库存（编辑时先还原再扣减）
function restoreSpareParts(consumedParts) {
  if (!Array.isArray(consumedParts) || consumedParts.length === 0) return;
  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const allParts = db.getAll('spareParts');
  let changed = false;
  for (const item of consumedParts) {
    const idx = allParts.findIndex(p => p.id === item.sparePartId);
    if (idx < 0) continue;
    allParts[idx] = { ...allParts[idx], quantity: allParts[idx].quantity + item.quantity, updatedAt: now };
    changed = true;
  }
  if (changed) db.setAll('spareParts', allParts);
}

// 解析记录中的 JSON 字符串字段，并关联设备编号
function parseRecord(record, eqMap) {
  if (!record) return record
  // 解析 JSON 字符串字段
  const jsonFields = ['photos', 'afterPhotos', 'consumedParts'];
  for (const field of jsonFields) {
    if (typeof record[field] === 'string' && record[field]) {
      try { record[field] = JSON.parse(record[field]) } catch { record[field] = [] }
    }
    if (!Array.isArray(record[field])) record[field] = []
  }
  // 照片兼容：旧 base64 保持不变，新文件名转为完整 URL
  const formatPhotos = (arr) => (arr || []).map(f => {
    if (typeof f === 'string' && !f.startsWith('data:') && !f.startsWith('/')) {
      return '/uploads/records/' + f
    }
    return f
  })
  record.photos = formatPhotos(record.photos)
  record.afterPhotos = formatPhotos(record.afterPhotos)
  // 关联设备编号（从映射表查，避免每次查数据库）
  if (record.equipmentId && !record.equipmentCode) {
    record.equipmentCode = eqMap ? eqMap[record.equipmentId] || '' : ''
  }
  return record
}

// 构建设备 ID → 编号映射表
function buildEqCodeMap() {
  const eqs = db.getAll('equipments')
  const map = {}
  for (const e of eqs) map[e.id] = e.code || ''
  return map
}

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, type, status, equipmentId, createdBy, startTime, endTime } = req.query;
  let list = db.getAll('records');
  const eqMap = buildEqCodeMap();
  list.forEach(r => parseRecord(r, eqMap));

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
  if (startTime) list = list.filter(r => (r.createdAt || '').slice(0, 10) >= startTime);
  if (endTime) list = list.filter(r => (r.createdAt || '').slice(0, 10) <= endTime);

  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const result = db.paginate(list, page, pageSize);
  res.json(success(result));
});

router.get('/stats', authMiddleware, (req, res) => {
  const { startTime, endTime } = req.query;
  let list = db.getAll('records');
  const eqMap = buildEqCodeMap();
  list.forEach(r => parseRecord(r, eqMap));

  if (startTime) list = list.filter(r => (r.createdAt || '').slice(0, 10) >= startTime);
  if (endTime) list = list.filter(r => (r.createdAt || '').slice(0, 10) <= endTime);

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
  res.json(success(parseRecord(record, buildEqCodeMap())));
});

router.post('/', authMiddleware, (req, res) => {
  const { equipmentId, equipmentCode, equipmentName, type, title, content, faultDescription, faultCause, solution, startTime, endTime, result, remark, photos, afterPhotos, status, personnel, cost, laborCost, partsCost, otherCost, partsReplaced, partsReplacedDetail, consumedParts, isStopped, stopDuration, stopDurationUnit } = req.body || {};
  if (!equipmentId || !type) return res.json(error('设备ID和类型为必填项'));

  const equip = db.findById('equipments', equipmentId);
  if (!equip) return res.json(error('关联设备不存在'));

  // 从 consumedParts 生成 partsReplacedDetail
  let detail = partsReplacedDetail || '';
  if (Array.isArray(consumedParts) && consumedParts.length > 0 && !detail) {
    detail = consumedParts.map(p => `${p.sparePartName} ×${p.quantity}`).join('、');
  }

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
    afterPhotos: Array.isArray(afterPhotos) ? JSON.stringify(afterPhotos) : (afterPhotos || ''),
    status: status || 'completed',
    personnel: personnel || '',
    cost: cost || 0,
    laborCost: laborCost || 0,
    partsCost: partsCost || 0,
    otherCost: otherCost || 0,
    partsReplaced: partsReplaced || 'no',
    partsReplacedDetail: detail,
    consumedParts: Array.isArray(consumedParts) ? JSON.stringify(consumedParts) : (consumedParts || ''),
    isStopped: isStopped || 'no',
    stopDuration: stopDuration || '',
    stopDurationUnit: stopDurationUnit || 'minutes',
    createdBy: req.user.id,
    updatedBy: req.user.id
  };

  const created = db.insert('records', newRecord);

  // 只做只读校验，获取警告信息
  let spareWarnings = [];
  if (partsReplaced === 'yes' && Array.isArray(consumedParts) && consumedParts.length > 0) {
    spareWarnings = validateSpareParts(consumedParts);
  }

  // 立即返回响应，不再等待备件扣减和通知写入
  res.json(success({ ...created, spareWarnings }, '记录创建成功'));

  // 异步批量操作：备件扣减 + 通知创建，不阻塞客户端
  const typeLabel = { repair: '维修', maintenance: '保养', inspection: '巡检', improvement: '改善' }[type] || type;
  const users = db.getAll('users');
  setImmediate(() => {
    // 1. 备件扣减
    if (partsReplaced === 'yes' && Array.isArray(consumedParts) && consumedParts.length > 0) {
      consumeSpareParts(consumedParts);
    }
    // 2. 批量通知
    const notifications = [];
    for (const u of users) {
      if (u.id === req.user.id) continue;
      notifications.push({
        type: 'new_record',
        title: '新工作记录',
        content: `${req.user.realName || req.user.username} 提交了「${equipmentName || equip.name}」的${typeLabel}记录`,
        targetUrl: `/record/${created.id}`,
        targetUserId: u.id,
        read: false
      });
    }
    if (notifications.length > 0) {
      db.batchInsert('notifications', notifications);
    }
  });
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
  if (req.body.afterPhotos !== undefined) {
    updates.afterPhotos = Array.isArray(req.body.afterPhotos) ? JSON.stringify(req.body.afterPhotos) : (req.body.afterPhotos || '');
  }

  // 处理 consumedParts：先还原旧消耗，再扣减新消耗
  let spareWarnings = [];
  const oldParts = existing.consumedParts;
  const newParts = req.body.consumedParts;
  if (req.body.consumedParts !== undefined) {
    updates.consumedParts = JSON.stringify(newParts);
    updates.partsReplaced = req.body.partsReplaced || existing.partsReplaced;
    // 只做只读校验
    if (Array.isArray(newParts) && newParts.length > 0) {
      spareWarnings = validateSpareParts(newParts);
      if (!updates.partsReplacedDetail) {
        updates.partsReplacedDetail = newParts.map(p => `${p.sparePartName} ×${p.quantity}`).join('、');
      }
    }
  }

  updates.updatedBy = req.user.id;

  const updated = db.update('records', id, updates);
  res.json(success({ ...updated, spareWarnings }, '记录更新成功'));

  // 异步：还原旧备件 + 扣减新备件
  if (req.body.consumedParts !== undefined) {
    setImmediate(() => {
      let parsedOld = oldParts;
      if (typeof parsedOld === 'string' && parsedOld) {
        try { parsedOld = JSON.parse(parsedOld) } catch { parsedOld = [] }
      }
      if (Array.isArray(parsedOld) && parsedOld.length > 0) {
        restoreSpareParts(parsedOld);
      }
      if (Array.isArray(newParts) && newParts.length > 0) {
        consumeSpareParts(newParts);
      }
    });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.remove('records', id);
  if (!result) return res.json(error('记录不存在', 404));
  res.json(success(null, '记录删除成功'));
});

module.exports = router;
