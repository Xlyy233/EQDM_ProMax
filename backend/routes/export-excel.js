const express = require('express');
const ExcelJS = require('exceljs');
const axios = require('axios');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { success, error } = require('../utils/helper');

const router = express.Router();

// 常量配置
const MAX_EXPORT_COUNT = 500;           // 最大导出条数
const MAX_IMAGE_WIDTH = 120;            // 图片最大宽度(px)
const MAX_IMAGE_HEIGHT = 90;            // 图片最大高度(px)
const IMAGE_CELL_WIDTH = 18;            // 图片列宽(字符数)
const IMAGE_ROW_HEIGHT = 75;            // 图片行高(pt)
const PHOTO_START_COL = 16;             // 图片起始列索引(1开始，P列)
const MAX_PHOTOS_PER_ROW = 5;           // 每行最多展示图片数

/**
 * 下载图片并转为 buffer
 * @param {string} url 图片URL
 * @returns {Promise<Buffer|null>}
 */
async function downloadImage(url) {
  try {
    // 支持 base64 内嵌图片
    if (url.startsWith('data:image')) {
      const base64Data = url.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }
    // 支持本地路径（以 /uploads/ 开头的相对路径）
    if (url.startsWith('/uploads/')) {
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(__dirname, '..', 'public', url);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    }
    // 远程URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024, // 10MB
    });
    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error(`下载图片失败: ${url}`, err.message);
    return null;
  }
}

/**
 * 获取图片尺寸并按比例缩放
 * @param {Buffer} buffer 图片buffer
 * @returns {{width: number, height: number}}
 */
function getScaledSize(buffer) {
  // exceljs 会自动处理图片原始尺寸，这里我们返回目标尺寸
  // 实际比例由 exceljs 在插入时保持
  return { width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_HEIGHT };
}

/**
 * 解析照片列表
 * @param {any} photos 数据库中的photos字段
 * @returns {string[]}
 */
function parsePhotos(photos) {
  if (!photos) return [];
  if (Array.isArray(photos)) return photos.filter(p => p && String(p).trim());
  try {
    const parsed = JSON.parse(photos);
    if (Array.isArray(parsed)) return parsed.filter(p => p && String(p).trim());
    return [];
  } catch {
    // 可能是逗号分隔的字符串
    const str = String(photos).trim();
    if (!str) return [];
    if (str.startsWith('[')) return [];
    return str.split(',').map(s => s.trim()).filter(s => s);
  }
}

/**
 * 生成 Excel 文件
 * @param {Array} records 维修记录列表
 * @param {string} startDate 起始日期
 * @param {string} endDate 结束日期
 * @returns {Promise<Buffer>}
 */
async function generateExcel(records, startDate, endDate) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('维修记录');

  // 设置列宽
  worksheet.columns = [
    { header: '设备编号', key: 'equipmentCode', width: 16 },
    { header: '设备名称', key: 'equipmentName', width: 20 },
    { header: '维修类型', key: 'type', width: 12 },
    { header: '状态', key: 'status', width: 12 },
    { header: '描述', key: 'description', width: 35 },
    { header: '维修人员', key: 'personnel', width: 14 },
    { header: '开始时间', key: 'startTime', width: 20 },
    { header: '结束时间', key: 'endTime', width: 20 },
    { header: '是否停机', key: 'isStopped', width: 12 },
    { header: '停机时长', key: 'stopDuration', width: 14 },
    { header: '是否更换配件', key: 'partsReplaced', width: 14 },
    { header: '更换配件详情', key: 'partsReplacedDetail', width: 25 },
    { header: '故障描述', key: 'faultDescription', width: 35 },
    { header: '故障原因', key: 'faultCause', width: 30 },
    { header: '解决办法', key: 'solution', width: 30 },
    // 图片列：最多预留 MAX_PHOTOS_PER_ROW 列
    ...Array.from({ length: MAX_PHOTOS_PER_ROW }, (_, i) => ({
      header: i === 0 ? '图片' : '',
      key: `photo_${i}`,
      width: IMAGE_CELL_WIDTH
    }))
  ];

  // 设置表头样式
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      right: { style: 'thin', color: { argb: 'FFD9E1F2' } }
    };
  });

  // 冻结首行
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const typeMap = { repair: '维修', maintenance: '保养', inspection: '巡检', improvement: '改善' };
  const statusMap = { completed: '已完成', approved: '已审核', pending: '待处理', in_progress: '处理中', cancelled: '已取消' };

  // 逐行写入数据并插入图片
  for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
    const record = records[rowIndex];
    const excelRowIndex = rowIndex + 2; // Excel 行号从2开始(1是表头)
    const row = worksheet.getRow(excelRowIndex);

    // 设置行高（有图片的行需要更高）
    row.height = IMAGE_ROW_HEIGHT;

    // 写入文本数据
    row.getCell(1).value = record.equipmentCode || '';
    row.getCell(2).value = record.equipmentName || '';
    row.getCell(3).value = typeMap[record.type] || record.type || '';
    row.getCell(4).value = statusMap[record.status] || record.status || '';
    row.getCell(5).value = record.description || record.content || record.title || '';
    row.getCell(6).value = record.personnel || '';
    row.getCell(7).value = record.startTime || '';
    row.getCell(8).value = record.endTime || '';
    row.getCell(9).value = record.isStopped === 'yes' ? '是' : '否';
    row.getCell(10).value = record.isStopped === 'yes' && record.stopDuration
      ? (record.stopDuration + (record.stopDurationUnit === 'hours' ? '小时' : '分钟'))
      : '';
    row.getCell(11).value = record.partsReplaced === 'yes' ? '是' : '否';
    row.getCell(12).value = record.partsReplaced === 'yes' ? (record.partsReplacedDetail || '') : '';
    row.getCell(13).value = record.faultDescription || record.description || record.content || '';
    row.getCell(14).value = record.faultCause || '';
    row.getCell(15).value = record.solution || '';

    // 设置文本单元格样式
    const textColCount = 15;
    for (let c = 1; c <= textColCount; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        right: { style: 'thin', color: { argb: 'FFD9E1F2' } }
      };
    }

    // 解析并下载图片
    const photoUrls = parsePhotos(record.photos);
    const imagesToInsert = [];

    // 并行下载图片
    const downloadResults = await Promise.all(
      photoUrls.slice(0, MAX_PHOTOS_PER_ROW).map(url => downloadImage(url))
    );

    downloadResults.forEach((buffer, idx) => {
      if (buffer) {
        const ext = photoUrls[idx].match(/\.([a-zA-Z]+)(?:\?|$)/)?.[1] || 'png';
        const imageId = workbook.addImage({
          buffer,
          extension: ext === 'jpg' ? 'jpeg' : ext
        });
        imagesToInsert.push({ imageId, colIndex: idx });
      }
    });

    // 插入图片到单元格（横向排列）
    imagesToInsert.forEach(({ imageId, colIndex }) => {
      const col = PHOTO_START_COL + colIndex; // 从H列开始
      worksheet.addImage(imageId, {
        tl: { col: col - 1, row: excelRowIndex - 1 }, // exceljs 使用0基索引
        ext: { width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_HEIGHT },
        editAs: 'oneCell'
      });
    });

    // 图片列也设置边框
    for (let c = PHOTO_START_COL; c < PHOTO_START_COL + MAX_PHOTOS_PER_ROW; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        right: { style: 'thin', color: { argb: 'FFD9E1F2' } }
      };
    }
  }

  // 自动筛选
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 15 }
  };

  // 写入文件 buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * GET /api/export-excel/records
 * 导出维修记录为 Excel（含图片）
 */
router.get('/records', authMiddleware, async (req, res) => {
  try {
    const { startTime, endTime, type, equipmentId } = req.query;

    // 查询记录
    let list = db.getAll('records');
    if (startTime) list = list.filter(r => r.createdAt >= startTime);
    if (endTime) {
      const endDate = endTime + ' 23:59:59';
      list = list.filter(r => r.createdAt <= endDate);
    }
    if (type) list = list.filter(r => r.type === type);
    if (equipmentId) list = list.filter(r => r.equipmentId === equipmentId);

    // 限制导出数量
    if (list.length > MAX_EXPORT_COUNT) {
      list = list.slice(0, MAX_EXPORT_COUNT);
    }

    if (list.length === 0) {
      return res.json(error('该时间范围内无记录数据'));
    }

    // 获取设备信息补充编号
    const equipments = db.getAll('equipments');
    const equipMap = {};
    equipments.forEach(e => { equipMap[e.id] = e; });

    // 补充字段
    const enrichedRecords = list.map(r => ({
      ...r,
      equipmentCode: (equipMap[r.equipmentId] && equipMap[r.equipmentId].code) || r.equipmentCode || '',
      equipmentName: r.equipmentName || (equipMap[r.equipmentId] && equipMap[r.equipmentId].name) || '',
      description: r.content || r.title || r.description || ''
    }));

    // 生成文件名
    const sDate = startTime ? String(startTime).slice(0, 10).replace(/-/g, '') : '';
    const eDate = endTime ? String(endTime).slice(0, 10).replace(/-/g, '') : '';
    const filename = `维修记录_${sDate}_${eDate}.xlsx`;

    // 生成 Excel
    const buffer = await generateExcel(enrichedRecords, startTime, endTime);

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('导出Excel失败:', err);
    res.status(500).json(error('导出Excel失败: ' + err.message, 500));
  }
});

module.exports = router;
