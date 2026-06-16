const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { success, error } = require('../utils/helper');
const { generateToken, authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

function withoutPassword(user) {
  const { password, ...rest } = user;
  return rest;
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.json(error('用户名和密码不能为空'));
  }

  const user = db.findBy('users', u => u.username === username);
  if (!user) {
    return res.json(error('用户不存在'));
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.json(error('密码错误'));
  }

  const token = generateToken(user);
  return res.json(success({ token, user: withoutPassword(user) }, '登录成功'));
});

router.get('/profile', authMiddleware, (req, res) => {
  const user = db.findById('users', req.user.id);
  if (!user) return res.json(error('用户不存在', 404));
  res.json(success(withoutPassword(user)));
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.json(error('参数不完整'));
  const user = db.findById('users', req.user.id);
  if (!user) return res.json(error('用户不存在', 404));
  const valid = bcrypt.compareSync(oldPassword, user.password);
  if (!valid) return res.json(error('原密码错误'));
  const hash = bcrypt.hashSync(newPassword, 10);
  db.update('users', req.user.id, { password: hash });
  res.json(success(null, '密码修改成功'));
});

router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, keyword, role: roleFilter, department } = req.query;

  let list = db.getAll('users');
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(u =>
      (u.username && u.username.toLowerCase().includes(kw)) ||
      (u.realName && u.realName.toLowerCase().includes(kw))
    );
  }
  if (roleFilter) {
    list = list.filter(u => u.role === roleFilter);
  }
  if (department) {
    list = list.filter(u => u.department === department);
  }
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const result = db.paginate(list, page, pageSize);
  result.list = result.list.map(withoutPassword);
  res.json(success(result));
});

router.get('/:id', authMiddleware, (req, res) => {
  const user = db.findById('users', req.params.id);
  if (!user) return res.json(error('用户不存在', 404));
  res.json(success(withoutPassword(user)));
});

router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, password, realName, role, department } = req.body || {};
  if (!username || !password || !realName) return res.json(error('用户名、密码、姓名为必填项'));

  const existing = db.findBy('users', u => u.username === username);
  if (existing) return res.json(error('用户名已存在'));

  const newUser = {
    username,
    password: bcrypt.hashSync(password, 10),
    realName,
    role: role || 'employee',
    department: department || ''
  };
  const created = db.insert('users', newUser);
  res.json(success(withoutPassword(created), '用户创建成功'));
});

router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const existing = db.findById('users', id);
  if (!existing) return res.json(error('用户不存在', 404));

  const { password, realName, role, department } = req.body || {};
  const updates = {};
  if (password) updates.password = bcrypt.hashSync(password, 10);
  if (realName !== undefined) updates.realName = realName;
  if (role !== undefined) updates.role = role;
  if (department !== undefined) updates.department = department;

  const updated = db.update('users', id, updates);
  res.json(success(withoutPassword(updated), '用户更新成功'));
});

router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.json(error('不能删除当前登录用户'));
  const result = db.remove('users', id);
  if (!result) return res.json(error('用户不存在', 404));
  res.json(success(null, '用户删除成功'));
});

module.exports = router;
