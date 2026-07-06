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
// 路径安全过滤：仅允许字母数字、连字符和下划线
function sanitizeId(id) {
  return (id || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

router.get('/equipment/:equipmentId', authMiddleware, (req, res) => {
  const equipmentId = sanitizeId(req.params.equipmentId);
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

// 下载/预览附件文件（设置 Content-Type 和 inline 头，确保浏览器内联显示）
router.get('/file/:equipmentId/:fileName', authMiddleware, (req, res) => {
  const equipmentId = sanitizeId(req.params.equipmentId);
  const fileName = req.params.fileName;
  // 安全检查：文件名不能包含路径分隔符
  if (fileName.includes('/') || fileName.includes('\\')) {
    return res.status(403).json(error('非法的文件路径'));
  }
  const filePath = path.join(uploadsDir, equipmentId, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json(error('文件不存在'));
  }
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  // 图片和PDF内联显示，其他文件触发下载
  const isInline = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt'].includes(ext);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', isInline ? 'inline' : 'attachment; filename="' + encodeURIComponent(fileName) + '"');
  res.sendFile(filePath);
});

module.exports = router;