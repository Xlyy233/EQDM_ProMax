const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function buildCSV(rows, columns) {
  const headers = columns.map(c => c.label).join(',');
  const lines = rows.map(row => columns.map(c => escapeCSV(row[c.key])).join(','));
  return '\uFEFF' + [headers, ...lines].join('\n');
}

router.get('/records', authMiddleware, (req, res) => {
  const { startTime, endTime, type, equipmentId } = req.query;
  let list = db.getAll('records');
  if (startTime) list = list.filter(r => r.createdAt >= startTime);
  if (endTime) list = list.filter(r => r.createdAt <= endTime);
  if (type) list = list.filter(r => r.type === type);
  if (equipmentId) list = list.filter(r => r.equipmentId === equipmentId);

  const typeMap = { repair: '维修', maintenance: '保养', inspection: '巡检', improvement: '改善' };
  const statusMap = { completed: '已完成', approved: '已审核', pending: '待处理' };

  const exportRows = list.map(r => ({
    id: r.id,
    equipmentName: r.equipmentName,
    type: typeMap[r.type] || r.type,
    title: r.title,
    content: r.content,
    startTime: r.startTime,
    endTime: r.endTime,
    result: r.result,
    remark: r.remark,
    status: statusMap[r.status] || r.status,
    cost: r.cost,
    createdBy: r.createdBy,
    createdAt: r.createdAt
  }));

  const columns = [
    { key: 'id', label: '记录编号' },
    { key: 'equipmentName', label: '设备名称' },
    { key: 'type', label: '类型' },
    { key: 'title', label: '标题' },
    { key: 'content', label: '内容' },
    { key: 'startTime', label: '开始时间' },
    { key: 'endTime', label: '结束时间' },
    { key: 'result', label: '处理结果' },
    { key: 'remark', label: '备注' },
    { key: 'status', label: '状态' },
    { key: 'cost', label: '费用(元)' },
    { key: 'createdAt', label: '创建时间' }
  ];

  const summary = {
    total: list.length,
    repair: list.filter(r => r.type === 'repair').length,
    maintenance: list.filter(r => r.type === 'maintenance').length,
    inspection: list.filter(r => r.type === 'inspection').length,
    improvement: list.filter(r => r.type === 'improvement').length
  };

  if (req.query.format === 'json') {
    return res.json(success({ records: exportRows, summary }));
  }

  const csv = buildCSV(exportRows, columns);
  const filename = `运维记录_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(csv);
});

router.get('/equipments', authMiddleware, (req, res) => {
  const list = db.getAll('equipments');
  const statusMap = { in_use: '在用', stopped: '停用', scrapped: '报废' };
  const exportRows = list.map(e => ({
    code: e.code, name: e.name, model: e.model, purchaseDate: e.purchaseDate,
    department: e.department, location: e.location, status: statusMap[e.status] || e.status,
    qrcode: e.qrcode, createdAt: e.createdAt
  }));
  const columns = [
    { key: 'code', label: '设备编号' },
    { key: 'name', label: '设备名称' },
    { key: 'model', label: '规格型号' },
    { key: 'purchaseDate', label: '购置日期' },
    { key: 'department', label: '使用部门' },
    { key: 'location', label: '存放位置' },
    { key: 'status', label: '状态' },
    { key: 'qrcode', label: '二维码' },
    { key: 'createdAt', label: '录入时间' }
  ];
  const csv = buildCSV(exportRows, columns);
  const filename = `设备台账_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(csv);
});

module.exports = router;
