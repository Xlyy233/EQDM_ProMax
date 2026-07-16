const express = require('express');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success } = require('../utils/helper');

const router = express.Router();

// 生成 ID
function genId() {
  return 'sp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 列表（支持搜索、低库存筛选）
router.get('/', authMiddleware, (req, res) => {
  const { keyword, lowStock, page = 1, pageSize = 20 } = req.query;
  let list = db.getAll('spareParts') || [];

  // 搜索
  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(s =>
      (s.name || '').toLowerCase().includes(kw) ||
      (s.spec || '').toLowerCase().includes(kw) ||
      (s.equipmentName || '').toLowerCase().includes(kw)
    );
  }

  // 低库存
  if (lowStock === 'true') {
    list = list.filter(s => s.quantity <= s.minStock);
  }

  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const total = list.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const paged = list.slice(start, start + parseInt(pageSize));

  res.json(success({ list: paged, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

// 低库存预警列表
router.get('/low-stock', authMiddleware, (req, res) => {
  const list = (db.getAll('spareParts') || []).filter(s => s.quantity <= s.minStock);
  res.json(success({ list, total: list.length }));
});

// 详情
router.get('/:id', authMiddleware, (req, res) => {
  const item = db.findById('spareParts', req.params.id);
  if (!item) return res.json({ code: 404, data: null, message: '备件不存在' });
  res.json(success(item));
});

// 新增
router.post('/', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { name, spec, quantity, minStock, unit, location, equipmentId, equipmentName, remark } = req.body;
  if (!name) return res.json({ code: 400, data: null, message: '备件名称不能为空' });

  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const item = {
    id: genId(),
    name: name.trim(),
    spec: spec || '',
    quantity: parseInt(quantity) || 0,
    minStock: parseInt(minStock) || 0,
    unit: unit || '个',
    location: location || '',
    equipmentId: equipmentId || '',
    equipmentName: equipmentName || '',
    remark: remark || '',
    createdAt: now,
    updatedAt: now
  };

  db.insert('spareParts', item);
  res.json(success(item));
});

// 编辑
router.put('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const existing = db.findById('spareParts', req.params.id);
  if (!existing) return res.json({ code: 404, data: null, message: '备件不存在' });

  const { name, spec, quantity, minStock, unit, location, equipmentId, equipmentName, remark } = req.body;
  const updated = db.update('spareParts', req.params.id, {
    name: name !== undefined ? name.trim() : existing.name,
    spec: spec !== undefined ? spec : existing.spec,
    quantity: quantity !== undefined ? parseInt(quantity) : existing.quantity,
    minStock: minStock !== undefined ? parseInt(minStock) : existing.minStock,
    unit: unit || existing.unit,
    location: location !== undefined ? location : existing.location,
    equipmentId: equipmentId !== undefined ? equipmentId : existing.equipmentId,
    equipmentName: equipmentName !== undefined ? equipmentName : existing.equipmentName,
    remark: remark !== undefined ? remark : existing.remark,
    updatedAt: new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
  });

  res.json(success(updated));
});

// 入库
router.put('/:id/stock-in', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const existing = db.findById('spareParts', req.params.id);
  if (!existing) return res.json({ code: 404, data: null, message: '备件不存在' });

  const { amount, remark } = req.body;
  const addAmount = parseInt(amount) || 0;
  if (addAmount <= 0) return res.json({ code: 400, data: null, message: '入库数量必须大于0' });

  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const updated = db.update('spareParts', req.params.id, {
    quantity: existing.quantity + addAmount,
    updatedAt: now
  });

  // 记录日志
  const logEntry = {
    id: 'spl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sparePartId: req.params.id,
    sparePartName: existing.name,
    type: 'stock-in',
    amount: addAmount,
    beforeQuantity: existing.quantity,
    afterQuantity: existing.quantity + addAmount,
    operatorId: req.user.id,
    operatorName: req.user.name || req.user.username,
    remark: remark || '',
    createdAt: now
  };
  db.insert('sparePartLogs', logEntry);

  res.json(success(updated));
});

// 出库
router.put('/:id/stock-out', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const existing = db.findById('spareParts', req.params.id);
  if (!existing) return res.json({ code: 404, data: null, message: '备件不存在' });

  const { amount, remark } = req.body;
  const subAmount = parseInt(amount) || 0;
  if (subAmount <= 0) return res.json({ code: 400, data: null, message: '出库数量必须大于0' });
  if (existing.quantity < subAmount) return res.json({ code: 400, data: null, message: '库存不足' });

  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const updated = db.update('spareParts', req.params.id, {
    quantity: existing.quantity - subAmount,
    updatedAt: now
  });

  // 记录日志
  const logEntry = {
    id: 'spl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sparePartId: req.params.id,
    sparePartName: existing.name,
    type: 'stock-out',
    amount: subAmount,
    beforeQuantity: existing.quantity,
    afterQuantity: existing.quantity - subAmount,
    operatorId: req.user.id,
    operatorName: req.user.name || req.user.username,
    remark: remark || '',
    createdAt: now
  };
  db.insert('sparePartLogs', logEntry);

  res.json(success(updated));
});

// 删除
router.delete('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const existing = db.findById('spareParts', req.params.id);
  if (!existing) return res.json({ code: 404, data: null, message: '备件不存在' });
  db.remove('spareParts', req.params.id);
  res.json(success(null));
});

module.exports = router;