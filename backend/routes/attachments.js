const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

// 上传目录
const uploadsDir = path.join(__dirname, '..', 'uploads', 'equipment');

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer 配置
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const equipmentId = req.params.equipmentId;
    const dir = path.join(uploadsDir, equipmentId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// 获取设备的所有附件
router.get('/equipment/:equipmentId', authMiddleware, (req, res) => {
  const { equipmentId } = req.params;
  const attachments = db.filter('attachments', a => a.equipmentId === equipmentId);
  attachments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(success(attachments));
});

// 批量获取多个设备的附件（一次请求返回所有设备附件）
router.post('/equipment/batch', authMiddleware, (req, res) => {
  const { equipmentIds } = req.body || {};
  if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
    return res.json(success({}));
  }
  const idSet = new Set(equipmentIds);
  const allAttachments = db.getAll('attachments');
  const result = {};
  for (const att of allAttachments) {
    if (idSet.has(att.equipmentId)) {
      if (!result[att.equipmentId]) result[att.equipmentId] = [];
      result[att.equipmentId].push(att);
    }
  }
  // 各组内按时间倒序
  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  res.json(success(result));
});

// 上传附件（支持批量，最多20个）
router.post('/equipment/:equipmentId', authMiddleware, upload.array('files', 20), (req, res) => {
  const { equipmentId } = req.params;
  const files = req.files;

  if (!files || files.length === 0) return res.json(error('未选择文件'));

  // 批量写入：一次磁盘操作完成所有附件记录，避免逐个insert导致的多次写盘
  const list = db.getAll('attachments');
  const now = db.now();
  const attachments = files.map(file => {
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const item = {
      id: db.genId('a'),
      equipmentId,
      originalName: decodedName,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      createdBy: req.user.id,
      createdAt: now
    };
    list.push(item);
    return item;
  });
  db.setAll('attachments', list);

  res.json(success(attachments, `成功上传 ${files.length} 个文件`));
});

// 删除附件
router.delete('/:id', authMiddleware, (req, res) => {
  const attachment = db.findById('attachments', req.params.id);
  if (!attachment) return res.json(error('附件不存在', 404));

  // 删除文件
  const filePath = path.join(uploadsDir, attachment.equipmentId, attachment.fileName);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}

  // 清理空目录
  const dir = path.join(uploadsDir, attachment.equipmentId);
  try {
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0) fs.rmdirSync(dir);
  } catch (e) {}

  db.remove('attachments', req.params.id);
  res.json(success(null, '删除成功'));
});

module.exports = router;