const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

// 文件存储目录
const uploadDir = path.join(__dirname, '..', 'uploads', 'files');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    file.originalname = original;
    cb(null, original);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });

// 文件分类列表
const CATEGORIES = ['设备档案', '维护手册', '操作规程', '备件清单', '巡检记录', '点检表', '培训资料', '维修报告', '其他'];

// 获取文件列表
router.get('/', authMiddleware, (req, res) => {
  try {
    let list = (db.getAll('fileShares') || []).sort((a, b) =>
      (b.uploadTime || '').localeCompare(a.uploadTime || '')
    );

    // 同步磁盘：批量移除磁盘上不存在的文件记录
    const missing = list.filter(f => !fs.existsSync(path.join(uploadDir, f.name)));
    if (missing.length > 0) {
      const missingIds = new Set(missing.map(f => f.id));
      const allFiles = db.getAll('fileShares');
      const filtered = allFiles.filter(f => !missingIds.has(f.id));
      db.setAll('fileShares', filtered);
      list = list.filter(f => !missing.includes(f));
    }

    res.json({ files: list.map(formatFile) });
  } catch (e) {
    console.error('获取文件列表失败:', e);
    res.json({ files: [] });
  }
});

// 上传文件
router.post('/upload', authMiddleware, upload.array('files', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json(error('未收到文件'));
    }
    const category = (req.body.category || '其他').trim();
    const deviceCode = (req.body.deviceCode || '').trim();
    const deviceName = (req.body.deviceName || '').trim();
    const description = (req.body.description || '').trim();
    const uploader = (req.body.uploader || '').trim() || req.user.realName || req.user.username;

    let count = 0;
    for (const file of req.files) {
      const existing = db.findBy('fileShares', f => f.name === file.originalname);
      if (existing) {
        db.update('fileShares', existing.id, {
          size: file.size,
          uploadTime: db.now(),
          category, deviceCode, deviceName, description, uploader
        });
      } else {
        db.insert('fileShares', {
          name: file.originalname,
          size: file.size,
          uploadTime: db.now(),
          category, deviceCode, deviceName, description, uploader,
          downloadCount: 0
        });
      }
      count++;
    }

    res.json(success({ count }, `成功上传 ${count} 个文件`));
  } catch (e) {
    console.error('上传失败:', e);
    res.status(500).json(error('上传失败: ' + e.message));
  }
});

// 下载文件
router.get('/download/:filename', authMiddleware, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json(error('文件不存在'));
  }

  // 更新下载次数
  const record = db.findBy('fileShares', f => f.name === filename);
  if (record) {
    db.update('fileShares', record.id, { downloadCount: (record.downloadCount || 0) + 1 });
  }

  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json(error('下载失败'));
    }
  });
});

// 删除单个文件
router.delete('/:filename', authMiddleware, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  try {
    const record = db.findBy('fileShares', f => f.name === filename);
    if (record) db.remove('fileShares', record.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json(success(null, '已删除'));
  } catch (e) {
    res.status(500).json(error('删除失败: ' + e.message));
  }
});

// 批量删除
router.post('/batch-delete', authMiddleware, (req, res) => {
  const { names } = req.body || {};
  if (!Array.isArray(names) || names.length === 0) {
    return res.json(error('参数错误'));
  }
  let deleted = 0;
  const allFiles = db.getAll('fileShares');
  const toDelete = new Set();
  for (const rawName of names) {
    const name = decodeURIComponent(rawName);
    const idx = allFiles.findIndex(f => f.name === name);
    if (idx >= 0) { toDelete.add(idx); deleted++; }
    const fp = path.join(uploadDir, name);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp) } catch {} }
  }
  if (toDelete.size > 0) {
    db.setAll('fileShares', allFiles.filter((_, i) => !toDelete.has(i)));
  }
  res.json(success({ deleted }, `已删除 ${deleted} 个文件`));
});

// 批量下载（打包为 zip）
router.post('/batch-download', authMiddleware, (req, res) => {
  const { names } = req.body || {};
  if (!Array.isArray(names) || names.length === 0) {
    return res.json(error('参数错误'));
  }

  // 批量更新下载次数
  const allFiles = db.getAll('fileShares');
  let dlChanged = false;
  for (const rawName of names) {
    const name = decodeURIComponent(rawName);
    const idx = allFiles.findIndex(f => f.name === name);
    if (idx >= 0) {
      allFiles[idx] = { ...allFiles[idx], downloadCount: (allFiles[idx].downloadCount || 0) + 1 };
      dlChanged = true;
    }
  }
  if (dlChanged) db.setAll('fileShares', allFiles);

  const zip = new AdmZip();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  let added = 0;
  names.forEach(rawName => {
    const name = decodeURIComponent(rawName);
    const fp = path.join(uploadDir, name);
    if (fs.existsSync(fp)) { zip.addLocalFile(fp, name); added++; }
  });
  if (added === 0) zip.addFile('README.txt', Buffer.from('请求的文件均不存在', 'utf8'));

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="equipment_files_${stamp}.zip"`);
  res.send(zip.toBuffer());
});

// 格式化文件信息
function formatFile(f) {
  return {
    id: f.id,
    name: f.name,
    size: f.size,
    uploadTime: f.uploadTime,
    category: f.category || '其他',
    deviceCode: f.deviceCode || '',
    deviceName: f.deviceName || '',
    description: f.description || '',
    uploader: f.uploader || '',
    downloadCount: f.downloadCount || 0
  };
}

module.exports = router;