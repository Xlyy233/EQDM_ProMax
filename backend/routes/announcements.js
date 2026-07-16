const express = require('express');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, error, now, genId, parsePagination } = require('../utils/helper');

const router = express.Router();

// 获取公告列表（所有登录用户可查看）
router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  let list = db.getAll('announcements');
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = list.length;
  const start = (page - 1) * pageSize;
  const pagedList = list.slice(start, start + pageSize);

  res.json(success({ list: pagedList, total, page, pageSize }));
});

// 获取当前活跃公告（首页展示用，返回最新一条）
router.get('/active', authMiddleware, (req, res) => {
  let list = db.getAll('announcements');
  list = list.filter(a => a.isActive).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(success(list.length > 0 ? list[0] : null));
});

// 获取单条公告详情
router.get('/:id', authMiddleware, (req, res) => {
  const item = db.findById('announcements', req.params.id);
  if (!item) return res.status(404).json(error('公告不存在', 404));
  res.json(success(item));
});

// 创建公告（管理员和经理）
router.post('/', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const { title, content, isActive } = req.body;
  if (!title || !title.trim()) return res.status(400).json(error('标题不能为空', 400));
  if (!content || !content.trim()) return res.status(400).json(error('内容不能为空', 400));

  const item = {
    id: genId('ann_'),
    title: title.trim(),
    content: content.trim(),
    isActive: typeof isActive === 'boolean' ? isActive : true,
    createdBy: req.user.id,
    createdByName: req.user.realName || req.user.username,
    createdAt: now(),
    updatedAt: now()
  };
  db.insert('announcements', item);
  res.json(success(item, '公告发布成功'));
});

// 更新公告（管理员和经理）
router.put('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const item = db.findById('announcements', req.params.id);
  if (!item) return res.status(404).json(error('公告不存在', 404));

  const { title, content, isActive } = req.body;
  if (title !== undefined) item.title = title.trim();
  if (content !== undefined) item.content = content.trim();
  if (isActive !== undefined) item.isActive = typeof isActive === 'boolean' ? isActive : item.isActive;
  item.updatedAt = now();

  db.update('announcements', item);
  res.json(success(item, '公告更新成功'));
});

// 删除公告（管理员和经理）
router.delete('/:id', authMiddleware, requireRole('admin', 'manager', 'maintenance_leader', 'inspection_leader', 'coordinator'), (req, res) => {
  const item = db.findById('announcements', req.params.id);
  if (!item) return res.status(404).json(error('公告不存在', 404));
  db.remove('announcements', req.params.id);
  res.json(success(null, '公告已删除'));
});

module.exports = router;