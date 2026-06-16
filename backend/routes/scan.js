const express = require('express');
const db = require('../config/db');
const { success, error } = require('../utils/helper');

const router = express.Router();

router.get('/:code', (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>设备台账系统 - 扫码</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #f5f7fa; }
          .container { max-width: 400px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .error-icon { font-size: 64px; margin-bottom: 20px; }
          .title { font-size: 24px; color: #303133; margin-bottom: 16px; }
          .desc { font-size: 16px; color: #606266; line-height: 1.6; }
          .btn { display: inline-block; padding: 12px 24px; background: #409EFF; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <div class="title">参数错误</div>
          <div class="desc">缺少设备编号参数</div>
          <a href="/" class="btn">返回首页</a>
        </div>
      </body>
      </html>
    `);
  }

  // 查找设备
  const equipment = db.findBy('equipments', e => e.code === decodeURIComponent(code));
  
  if (!equipment) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>设备台账系统 - 扫码</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #f5f7fa; }
          .container { max-width: 400px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .error-icon { font-size: 64px; margin-bottom: 20px; }
          .title { font-size: 24px; color: #303133; margin-bottom: 16px; }
          .desc { font-size: 16px; color: #606266; line-height: 1.6; }
          .btn { display: inline-block; padding: 12px 24px; background: #409EFF; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 24px; }
          .code { font-family: monospace; background: #f5f7fa; padding: 8px 16px; border-radius: 4px; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">📭</div>
          <div class="title">设备不存在</div>
          <div class="desc">未找到编号为 <span class="code">${code}</span> 的设备</div>
          <a href="/" class="btn">返回首页</a>
        </div>
      </body>
      </html>
    `);
  }

  // 返回设备信息页面
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>设备台账系统 - ${equipment.name}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #f5f7fa; }
        .container { max-width: 400px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .success-icon { font-size: 64px; margin-bottom: 20px; }
        .title { font-size: 24px; color: #303133; margin-bottom: 16px; }
        .name { font-size: 20px; color: #67C23A; font-weight: 500; margin-bottom: 24px; }
        .info { text-align: left; border-top: 1px solid #ebef5; padding-top: 20px; }
        .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f5f7fa; }
        .info-label { width: 100px; color: #909399; font-size: 14px; }
        .info-value { flex: 1; color: #303133; font-size: 14px; }
        .actions { margin-top: 24px; display: flex; gap: 12px; }
        .btn { flex: 1; display: inline-block; padding: 14px; text-decoration: none; border-radius: 8px; font-size: 14px; }
        .btn-primary { background: #409EFF; color: #fff; }
        .btn-success { background: #67C23A; color: #fff; }
        .app-link { margin-top: 20px; padding: 16px; background: #fff7e8; border-radius: 8px; }
        .app-link-icon { font-size: 24px; margin-right: 8px; }
        .app-link-text { color: #e6a23c; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <div class="title">扫码成功</div>
        <div class="name">${equipment.name}</div>
        
        <div class="info">
          <div class="info-row">
            <span class="info-label">设备编号</span>
            <span class="info-value">${equipment.code}</span>
          </div>
          <div class="info-row">
            <span class="info-label">型号</span>
            <span class="info-value">${equipment.model || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">部门</span>
            <span class="info-value">${equipment.department || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">位置</span>
            <span class="info-value">${equipment.location || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">状态</span>
            <span class="info-value">${equipment.status === 'in_use' ? '在用' : equipment.status === 'idle' ? '闲置' : equipment.status === 'maintenance' ? '维修中' : equipment.status}</span>
          </div>
        </div>
        
        <div class="actions">
          <a href="/#/pages/equipment/detail?id=${equipment.id}" class="btn btn-primary">查看详情</a>
          <a href="/#/pages/record/add?equipmentId=${equipment.id}&equipmentName=${encodeURIComponent(equipment.name || '')}" class="btn btn-success">添加记录</a>
        </div>
        
        <div class="app-link">
          <span class="app-link-icon">📱</span>
          <span class="app-link-text">建议使用设备台账APP进行扫码操作，功能更完整</span>
        </div>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;
