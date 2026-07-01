const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, department, status } = req.query;
  let list = db.getAll('equipments');

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(e =>
      (e.code && e.code.toLowerCase().includes(kw)) ||
      (e.name && e.name.toLowerCase().includes(kw)) ||
      (e.model && e.model.toLowerCase().includes(kw))
    );
  }
  if (department) list = list.filter(e => e.department === department);
  if (status) list = list.filter(e => e.status === status);

  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const result = db.paginate(list, page, pageSize);
  res.json(success(result));
});

router.get('/departments', authMiddleware, (req, res) => {
  const depts = [...new Set(db.getAll('equipments').map(e => e.department).filter(Boolean))];
  res.json(success(depts));
});

router.get('/qrcode', authMiddleware, (req, res) => {
  const { qrcode } = req.query;
  if (!qrcode) return res.json(error('qrcode 参数不能为空'));
  const equip = db.findBy('equipments', e => e.qrcode === qrcode);
  if (!equip) return res.json(error('未找到对应设备', 404));
  res.json(success(equip));
});

router.get('/:id', authMiddleware, (req, res) => {
  const equip = db.findById('equipments', req.params.id);
  if (!equip) return res.json(error('设备不存在', 404));
  res.json(success(equip));
});

router.post('/', authMiddleware, (req, res) => {
  const { code, name, model, purchaseDate, department, location, status } = req.body || {};
  if (!code || !name) return res.json(error('设备编号和名称为必填项'));

  const existing = db.findBy('equipments', e => e.code === code);
  if (existing) return res.json(error('设备编号已存在'));

  const body = req.body || {};
  const newEquip = {
    code, name,
    model: model || '',
    purchaseDate: purchaseDate || '',
    department: department || '',
    location: location || '',
    status: status || 'in_use',
    qrcode: 'EQDM-' + code,
    createdBy: req.user.id,
    updatedBy: req.user.id,
    // 新增字段
    keyEquipment: body.keyEquipment || '',
    productionLineCode: body.productionLineCode || '',
    factoryCode: body.factoryCode || '',
    assetType: body.assetType || '',
    assetStatus: body.assetStatus || '',
    brand: body.brand || '',
    quantity: body.quantity || '',
    enableDate: body.enableDate || '',
    factoryDate: body.factoryDate || '',
    ratedPower: body.ratedPower || '',
    useLocation: body.useLocation || '',
    departmentName: body.departmentName || ''
  };

  const created = db.insert('equipments', newEquip);
  res.json(success(created, '设备创建成功'));
});

router.post('/batch', authMiddleware, (req, res) => {
  const items = req.body || [];
  if (!Array.isArray(items) || items.length === 0) return res.json(error('批量导入数据不能为空'));

  let skipped = 0;
  const toInsert = [];
  const existingCodes = new Set(db.getAll('equipments').map(e => e.code));
  const now = db.now();

  for (const item of items) {
    if (!item.code || !item.name) { skipped++; continue; }
    if (existingCodes.has(item.code)) { skipped++; continue; }
    existingCodes.add(item.code);
    toInsert.push({
      code: item.code,
      name: item.name,
      model: item.model || '',
      purchaseDate: item.purchaseDate || '',
      department: item.department || '',
      location: item.location || '',
      status: item.status || 'in_use',
      qrcode: item.qrcode || 'EQDM-' + item.code,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      createdAt: now,
      updatedAt: now,
      keyEquipment: item.keyEquipment || '',
      productionLineCode: item.productionLineCode || '',
      factoryCode: item.factoryCode || '',
      assetType: item.assetType || '',
      assetStatus: item.assetStatus || '',
      brand: item.brand || '',
      quantity: item.quantity || '',
      enableDate: item.enableDate || '',
      factoryDate: item.factoryDate || '',
      ratedPower: item.ratedPower || '',
      useLocation: item.useLocation || '',
      departmentName: item.departmentName || ''
    });
  }

  // 批量插入：一次写盘，避免逐条insert的多次磁盘I/O
  if (toInsert.length > 0) {
    db.batchInsert('equipments', toInsert);
  }

  res.json(success({ added: toInsert.length, skipped }, `批量导入完成，成功 ${toInsert.length} 条，跳过 ${skipped} 条`));
});

router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.findById('equipments', id);
  if (!existing) return res.json(error('设备不存在', 404));

  const updates = {};
  const fields = ['code', 'name', 'model', 'purchaseDate', 'department', 'location', 'status',
    'keyEquipment', 'productionLineCode', 'factoryCode', 'assetType', 'assetStatus',
    'brand', 'quantity', 'enableDate', 'factoryDate', 'ratedPower', 'useLocation', 'departmentName'];
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (updates.code) updates.qrcode = 'EQDM-' + updates.code;
  updates.updatedBy = req.user.id;

  const updated = db.update('equipments', id, updates);
  res.json(success(updated, '设备更新成功'));
});

router.delete('/all', authMiddleware, (req, res) => {
  const relatedRecords = db.count('records', () => true);
  const relatedPlans = db.count('maintenancePlans', () => true);
  
  db.clear('equipments');
  db.clear('records');
  db.clear('maintenancePlans');
  res.json(success({ deleted: { equipments: true, records: relatedRecords > 0, plans: relatedPlans > 0 } }, `设备数据已全部清空（同步删除关联记录 ${relatedRecords} 条、维保计划 ${relatedPlans} 条）`));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const related = db.count('records', r => r.equipmentId === id);
  if (related > 0) return res.json(error(`该设备关联 ${related} 条运维记录，请先处理后再删除`));
  const result = db.remove('equipments', id);
  if (!result) return res.json(error('设备不存在', 404));
  res.json(success(null, '设备删除成功'));
});

module.exports = router;
