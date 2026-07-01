const express = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

// 获取未读通知列表（当前用户）
router.get('/unread', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const list = db.getAll('notifications')
    .filter(n => n.targetUserId === userId && !n.read)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(success({ list, unreadCount: list.length }));
});

// 获取全部通知（分页，当前用户）
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { page, pageSize } = req.query;
  let list = db.getAll('notifications')
    .filter(n => n.targetUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = db.paginate(list, page, pageSize);
  const unreadCount = list.filter(n => !n.read).length;
  res.json(success({ ...result, unreadCount }));
});

// 标记通知为已读
router.put('/:id/read', authMiddleware, (req, res) => {
  const updated = db.update('notifications', req.params.id, { read: true });
  if (!updated) return res.json(error('通知不存在', 404));
  res.json(success(updated));
});

// 全部标记为已读（当前用户）
router.put('/read-all', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const list = db.getAll('notifications');
  list.forEach(n => {
    if (n.targetUserId === userId) n.read = true;
  });
  db.setAll('notifications', list);
  res.json(success(null, '已全部标记为已读'));
});

// 创建通知（内部调用）
function createNotification({ type, title, content, targetUrl, targetUserId }) {
  return db.insert('notifications', {
    type, title, content, targetUrl,
    targetUserId: targetUserId || '',
    read: false
  });
}

module.exports = router;
module.exports.createNotification = createNotification;