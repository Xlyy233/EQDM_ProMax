require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const { authMiddleware, requireRole } = require('./middleware/auth');
const { success } = require('./utils/helper');

const userRoutes = require('./routes/users');
const equipmentRoutes = require('./routes/equipments');
const recordRoutes = require('./routes/records');
const planRoutes = require('./routes/maintenancePlans');
const statsRoutes = require('./routes/statistics');
const exportRoutes = require('./routes/export');
const exportExcelRoutes = require('./routes/export-excel');
const scanRoutes = require('./routes/scan');
const logRoutes = require('./routes/logs');
const attachmentRoutes = require('./routes/attachments');
const knowledgeRoutes = require('./routes/knowledge');
const notificationRoutes = require('./routes/notifications');
const inspectionRoutes = require('./routes/inspections');
const announcementRoutes = require('./routes/announcements');
const sparePartRoutes = require('./routes/spareParts');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========== 数据自动备份 ==========
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'eqdm.db');
const backupDir = path.join(dataDir, 'backups');

function backupData() {
  try {
    if (!fs.existsSync(dbFile)) {
      logger.warn('备份跳过：数据库文件不存在');
      return;
    }
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date(new Date().getTime() + 8 * 60 * 60 * 1000)
      .toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
    const dest = path.join(backupDir, `eqdm_${timestamp}.db`);
    fs.copyFileSync(dbFile, dest);
    logger.info(`数据备份完成: eqdm_${timestamp}.db`);

    // 保留最近 30 份备份
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('eqdm_') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (let i = 30; i < files.length; i++) {
      fs.unlinkSync(path.join(backupDir, files[i]));
      logger.info(`清理旧备份: ${files[i]}`);
    }
  } catch (err) {
    logger.error('数据备份失败:', err.message);
  }
}

// 启动时备份
backupData();

// 每小时检查一次，凌晨 2:00（北京时间）执行备份
setInterval(() => {
  const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  if (now.getHours() === 2 && now.getMinutes() === 0) {
    backupData();
  }
}, 60 * 1000);

// 配置 CORS：自动允许本地网络 + 花生壳外网地址
const EXTERNAL_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);

function isLocalNetworkOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    // localhost / 127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    // 私有网络: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  } catch {}
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    // 同源请求（无 origin 头）直接放行
    if (!origin) return callback(null, true);
    // 本地网络自动放行
    if (isLocalNetworkOrigin(origin)) return callback(null, true);
    // 白名单中的外部地址
    if (EXTERNAL_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// 安全 HTTP 响应头
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use(logger.requestLogger);

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    code: 200,
    data: { 
      status: 'ok', 
      timestamp: new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString(), 
      version: '1.0.0',
      environment: NODE_ENV
    },
    message: '服务运行正常'
  });
});

// API 路由
app.use('/api/auth', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/maintenance-plans', planRoutes);
app.use('/api/statistics', statsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/export-excel', exportExcelRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/spare-parts', sparePartRoutes);
app.use('/api/files', fileRoutes);

// 系统工具路由
app.post('/api/system/backup', authMiddleware, requireRole('admin'), (req, res) => {
  backupData();
  const files = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(f => f.startsWith('eqdm_')).length : 0;
  res.json(success({ backupCount: files, message: '备份完成' }));
});

// 静态文件：上传的附件（始终注册，文件存在时正常返回，不存在时返回404）
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip', '.rar': 'application/x-rar-compressed'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';
    const isInline = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt'].includes(ext);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', isInline ? 'inline' : 'attachment; filename="' + encodeURIComponent(path.basename(filePath)) + '"');
  }
}));

// 服务前端静态文件（生产环境）
const distPath = path.join(__dirname, '..', 'webapp-new', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // index.html、sw.js、registerSW.js 禁止缓存，确保移动端能获取最新版本
      const basename = path.basename(filePath);
      if (basename === 'index.html' || basename === 'sw.js' || basename === 'registerSW.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        // 带hash的静态资源可以长期缓存
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

// 根目录文档文件（API文档.md等）开放访问
const rootPath = path.join(__dirname, '..');
app.use((req, res, next) => {
  const requested = req.path.replace(/^\/+/, '');
  if (/\.md$/i.test(requested)) {
    const filePath = path.join(rootPath, requested);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.sendFile(filePath);
    }
  }
  next();
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err.stack);
  res.status(500).json({
    code: 500,
    data: null,
    message: NODE_ENV === 'development' ? ('服务器内部错误: ' + err.message) : '服务器内部错误'
  });
});

// SPA 路由支持：所有非 API 路径返回前端 index.html
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    logger.warn('接口不存在: ' + req.method + ' ' + req.url);
    res.status(404).json({
      code: 404,
      data: null,
      message: '接口不存在: ' + req.method + ' ' + req.url
    });
  } else if (req.path.startsWith('/uploads/')) {
    // express.static 未找到文件，返回 404 而非首页
    res.status(404).json({ code: 404, data: null, message: '文件不存在' });
  } else {
    // 返回前端首页
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('<h1>前端资源未部署</h1><p>请先运行 npm run build 构建新前端资源</p>');
    }
  }
});

// 数据库初始化
const db = require('./config/db');
if (db.getAll('users').length === 0) {
  logger.info('数据库为空，正在初始化种子数据...');
  const { seedIfEmpty } = require('./scripts/init-db.js');
  seedIfEmpty();
}

// 启动服务
app.listen(PORT, () => {
  // 启动信息始终显示在控制台
  const startupMsg = [
    '========================================',
    '  设备台账与运维管理系统 - 后端服务',
    '========================================',
    `  服务地址: http://localhost:${PORT}`,
    `  API 前缀: /api`,
    `  健康检查: http://localhost:${PORT}/api/health`,
    `  数据文件: ./data/eqdm.db`,
    `  运行环境: ${NODE_ENV}`,
    '========================================',
    '  默认账号:',
    '    管理员: admin / admin123',
    '    部门经理: manager / manager123',
    '    员工共享: sa / 123456',
    '========================================'
  ];
  startupMsg.forEach(msg => console.log(msg));
  startupMsg.forEach(msg => logger.info(msg));
});

module.exports = app;
