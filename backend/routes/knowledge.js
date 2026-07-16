const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

// 上传目录
const uploadsDir = path.join(__dirname, '..', 'uploads', 'knowledge');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer 配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// 辅助：获取用户真实姓名
function getUserName(userId) {
  const user = db.findById('users', userId);
  return user ? (user.realName || user.username) : '未知用户';
}

// ==================== 图片上传 ====================

// 上传知识图片（批量）
router.post('/upload', authMiddleware, (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.json(error('文件大小超过限制（最大20MB）'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.json(error('上传文件数量超过限制（最多10张）'));
      }
      return res.json(error('上传失败: ' + (err.message || '未知错误')));
    }
    const files = req.files;
    if (!files || files.length === 0) return res.json(error('未选择文件'));

    const list = db.getAll('attachments');
    const now = db.now();
    const attachments = files.map(file => {
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const item = {
        id: db.genId('kimg'),
        equipmentId: 'knowledge',
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

    const result = attachments.map(att => ({
      id: att.id,
      url: '/uploads/knowledge/' + att.fileName,
      originalName: att.originalName
    }));

    res.json(success(result, `成功上传 ${files.length} 张图片`));
  });
});

// ==================== 知识文章 CRUD ====================

// 获取知识列表（分页 + 筛选）
router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize, category, keyword } = req.query;
  let list = db.getAll('knowledge');

  // 分类筛选
  if (category && category !== 'all') {
    list = list.filter(k => k.category === category);
  }

  // 关键词搜索
  if (keyword && keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    list = list.filter(k =>
      (k.title && k.title.toLowerCase().includes(kw)) ||
      (k.content && k.content.toLowerCase().includes(kw)) ||
      (k.tags && k.tags.some(t => t.toLowerCase().includes(kw)))
    );
  }

  // 按时间倒序
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const result = db.paginate(list, page, pageSize);
  res.json(success(result));
});

// 获取单篇详情
router.get('/:id', authMiddleware, (req, res) => {
  const item = db.findById('knowledge', req.params.id);
  if (!item) return res.json(error('文章不存在', 404));

  // 获取关联图片
  const images = [];
  if (item.imageIds && item.imageIds.length > 0) {
    for (const imgId of item.imageIds) {
      const att = db.findById('attachments', imgId);
      if (att && att.fileName) {
        // 防止路径遍历攻击
        const safeName = path.basename(att.fileName);
        images.push({
          id: att.id,
          url: '/uploads/knowledge/' + safeName,
          originalName: att.originalName
        });
      }
    }
  }

  // 检查当前用户是否已点赞
  const liked = !!db.findBy('knowledge_likes',
    l => l.knowledgeId === req.params.id && l.userId === req.user.id
  );

  res.json(success({ ...item, images, liked }));
});

// 创建文章
router.post('/', authMiddleware, (req, res) => {
  const { title, content, summary, category, tags, coverImageId, imageIds } = req.body;
  if (!title || !title.trim()) return res.json(error('请填写标题'));
  if (!content || !content.trim()) return res.json(error('请填写内容'));

  const item = {
    id: db.genId('k'),
    title: title.trim(),
    content: content.trim(),
    summary: summary ? summary.trim() : content.trim().slice(0, 150),
    category: category || 'tech',
    authorId: req.user.id,
    author: getUserName(req.user.id),
    tags: Array.isArray(tags) ? tags : [],
    coverImageId: coverImageId || '',
    imageIds: Array.isArray(imageIds) ? imageIds : [],
    likeCount: 0,
    commentCount: 0,
    createdAt: db.now(),
    updatedAt: db.now()
  };

  db.insert('knowledge', item);
  res.json(success(item, '发布成功'));
});

// 更新文章
router.put('/:id', authMiddleware, (req, res) => {
  const item = db.findById('knowledge', req.params.id);
  if (!item) return res.json(error('文章不存在', 404));

  const { title, content, summary, category, tags, coverImageId, imageIds } = req.body;
  if (title !== undefined) item.title = title.trim();
  if (content !== undefined) item.content = content.trim();
  if (summary !== undefined) item.summary = summary.trim();
  if (category !== undefined) item.category = category;
  if (tags !== undefined) item.tags = Array.isArray(tags) ? tags : [];
  if (coverImageId !== undefined) item.coverImageId = coverImageId;
  if (imageIds !== undefined) item.imageIds = Array.isArray(imageIds) ? imageIds : [];

  db.update('knowledge', req.params.id, item);
  res.json(success(item, '更新成功'));
});

// 删除文章
router.delete('/:id', authMiddleware, (req, res) => {
  const item = db.findById('knowledge', req.params.id);
  if (!item) return res.json(error('文章不存在', 404));

  // 删除关联图片文件
  if (item.imageIds && item.imageIds.length > 0) {
    for (const imgId of item.imageIds) {
      const att = db.findById('attachments', imgId);
      if (att) {
        const filePath = path.join(uploadsDir, att.fileName);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
      }
    }
    // 删除附件记录
    const allAtt = db.getAll('attachments').filter(a => !item.imageIds.includes(a.id));
    db.setAll('attachments', allAtt);
  }

  // 删除关联评论
  const comments = db.getAll('knowledge_comments').filter(c => c.knowledgeId !== req.params.id);
  db.setAll('knowledge_comments', comments);

  // 删除关联点赞
  const likes = db.getAll('knowledge_likes').filter(l => l.knowledgeId !== req.params.id);
  db.setAll('knowledge_likes', likes);

  db.remove('knowledge', req.params.id);
  res.json(success(null, '删除成功'));
});

// ==================== 点赞 ====================

// 切换点赞状态
router.post('/:id/like', authMiddleware, (req, res) => {
  const knowledgeId = req.params.id;
  const item = db.findById('knowledge', knowledgeId);
  if (!item) return res.json(error('文章不存在', 404));

  const existingLike = db.findBy('knowledge_likes',
    l => l.knowledgeId === knowledgeId && l.userId === req.user.id
  );

  if (existingLike) {
    // 取消点赞
    db.remove('knowledge_likes', existingLike.id);
    item.likeCount = Math.max(0, (item.likeCount || 0) - 1);
    db.update('knowledge', knowledgeId, { likeCount: item.likeCount });
    res.json(success({ liked: false, likeCount: item.likeCount }, '已取消点赞'));
  } else {
    // 点赞：防止重复点赞（再次确认）
    const recheck = db.findBy('knowledge_likes',
      l => l.knowledgeId === knowledgeId && l.userId === req.user.id
    );
    if (recheck) {
      return res.json(success({ liked: true, likeCount: item.likeCount || 0 }, '已点赞'));
    }
    db.insert('knowledge_likes', {
      id: db.genId('kl'),
      knowledgeId,
      userId: req.user.id,
      createdAt: db.now()
    });
    item.likeCount = (item.likeCount || 0) + 1;
    db.update('knowledge', knowledgeId, { likeCount: item.likeCount });
    res.json(success({ liked: true, likeCount: item.likeCount }, '点赞成功'));
  }
});

// ==================== 评论 ====================

// 获取评论列表
router.get('/:id/comments', authMiddleware, (req, res) => {
  const knowledgeId = req.params.id;
  const comments = db.filter('knowledge_comments', c => c.knowledgeId === knowledgeId);
  comments.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  res.json(success(comments));
});

// 添加评论
router.post('/:id/comments', authMiddleware, (req, res) => {
  const knowledgeId = req.params.id;
  const item = db.findById('knowledge', knowledgeId);
  if (!item) return res.json(error('文章不存在', 404));

  const { content } = req.body;
  if (!content || !content.trim()) return res.json(error('请输入评论内容'));

  const comment = {
    id: db.genId('kc'),
    knowledgeId,
    content: content.trim(),
    authorId: req.user.id,
    author: getUserName(req.user.id),
    createdAt: db.now()
  };

  db.insert('knowledge_comments', comment);

  // 更新评论数
  item.commentCount = (item.commentCount || 0) + 1;
  db.update('knowledge', knowledgeId, { commentCount: item.commentCount });

  res.json(success(comment, '评论成功'));
});

// 删除评论
router.delete('/comments/:commentId', authMiddleware, (req, res) => {
  const comment = db.findById('knowledge_comments', req.params.commentId);
  if (!comment) return res.json(error('评论不存在', 404));

  // 只有评论作者或管理员可以删除
  if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
    return res.json(error('无权删除此评论', 403));
  }

  db.remove('knowledge_comments', req.params.commentId);

  // 更新评论数
  const item = db.findById('knowledge', comment.knowledgeId);
  if (item) {
    item.commentCount = Math.max(0, (item.commentCount || 0) - 1);
    db.update('knowledge', comment.knowledgeId, { commentCount: item.commentCount });
  }

  res.json(success(null, '删除成功'));
});

module.exports = router;