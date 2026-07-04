const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const {
  getAll, insert, update, remove, findById, filter, paginate, now, genId
} = require('../config/db')
const { success } = require('../utils/helper')

const router = express.Router()
const TABLE_TEMPLATES = 'inspectionTemplates'
const TABLE_RECORDS = 'inspectionRecords'

// ========== 巡检模板 ==========

// 获取模板列表
router.get('/templates', authMiddleware, (req, res) => {
  try {
    const { equipmentType, keyword, page, pageSize } = req.query
    let list = getAll(TABLE_TEMPLATES)
    if (equipmentType) list = list.filter(t => t.equipmentType === equipmentType)
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(t => t.name.toLowerCase().includes(kw) || t.equipmentType.toLowerCase().includes(kw))
    }
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    const result = paginate(list, page, pageSize)
    res.json(success(result))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '获取模板列表失败' })
  }
})

// 获取单个模板
router.get('/templates/:id', authMiddleware, (req, res) => {
  const t = findById(TABLE_TEMPLATES, req.params.id)
  if (!t) return res.status(404).json({ code: 404, data: null, message: '模板不存在' })
  res.json(success(t))
})

// 创建模板
router.post('/templates', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
  try {
    const { name, equipmentType, items } = req.body || {}
    if (!name || !equipmentType || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, data: null, message: '模板名称、设备类型和巡检项目不能为空' })
    }
    const template = {
      name: name.trim(),
      equipmentType: equipmentType.trim(),
      items: items.map((it, i) => ({
        id: genId('i'),
        content: (it.content || '').trim(),
        order: it.order ?? i
      })),
      createdBy: req.user?.username || ''
    }
    const result = insert(TABLE_TEMPLATES, template)
    res.json(success(result))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '创建模板失败' })
  }
})

// 更新模板
router.put('/templates/:id', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
  try {
    const existing = findById(TABLE_TEMPLATES, req.params.id)
    if (!existing) return res.status(404).json({ code: 404, data: null, message: '模板不存在' })
    const { name, equipmentType, items } = req.body || {}
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (equipmentType !== undefined) updates.equipmentType = equipmentType.trim()
    if (items !== undefined && Array.isArray(items)) {
      updates.items = items.map((it, i) => ({
        id: it.id || genId('i'),
        content: (it.content || '').trim(),
        order: it.order ?? i
      }))
    }
    const result = update(TABLE_TEMPLATES, req.params.id, updates)
    res.json(success(result))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '更新模板失败' })
  }
})

// 删除模板
router.delete('/templates/:id', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
  try {
    const ok = remove(TABLE_TEMPLATES, req.params.id)
    if (!ok) return res.status(404).json({ code: 404, data: null, message: '模板不存在' })
    res.json(success(null))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '删除模板失败' })
  }
})

// 按设备类型获取模板（员工巡检时使用）
router.get('/templates/by-type/:equipmentType', authMiddleware, (req, res) => {
  try {
    const t = filter(TABLE_TEMPLATES, t => t.equipmentType === req.params.equipmentType)
    res.json(success(t))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '获取模板失败' })
  }
})

// ========== 巡检记录 ==========

// 获取记录列表
router.get('/records', authMiddleware, (req, res) => {
  try {
    const { equipmentId, inspector, startDate, endDate, keyword, page, pageSize } = req.query
    let list = getAll(TABLE_RECORDS)
    if (equipmentId) list = list.filter(r => r.equipmentId === equipmentId)
    if (inspector) list = list.filter(r => r.inspector === inspector)
    if (startDate) list = list.filter(r => r.inspectionDate >= startDate)
    if (endDate) list = list.filter(r => r.inspectionDate <= endDate + ' 23:59:59')
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(r =>
        r.equipmentName.toLowerCase().includes(kw) ||
        r.equipmentCode.toLowerCase().includes(kw) ||
        r.templateName.toLowerCase().includes(kw)
      )
    }
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const result = paginate(list, page, pageSize)
    res.json(success(result))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '获取记录列表失败' })
  }
})

// 获取单条记录
router.get('/records/:id', authMiddleware, (req, res) => {
  const r = findById(TABLE_RECORDS, req.params.id)
  if (!r) return res.status(404).json({ code: 404, data: null, message: '记录不存在' })
  res.json(success(r))
})

// 创建巡检记录
router.post('/records', authMiddleware, (req, res) => {
  try {
    const {
      templateId, templateName, equipmentId, equipmentCode, equipmentName,
      items, photos, afterPhotos, remark, inspectionDate
    } = req.body || {}

    if (!equipmentId || !equipmentCode || !equipmentName) {
      return res.status(400).json({ code: 400, data: null, message: '请选择设备' })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, data: null, message: '巡检项目不能为空' })
    }

    const record = {
      templateId: templateId || '',
      templateName: templateName || '',
      equipmentId,
      equipmentCode,
      equipmentName,
      inspector: req.user?.username || '',
      inspectionDate: inspectionDate || now().slice(0, 10),
      items: items.map(it => ({
        id: it.id,
        content: it.content || '',
        checked: !!it.checked,
        remark: it.remark || ''
      })),
      photos: Array.isArray(photos) ? JSON.stringify(photos) : (photos || ''),
      afterPhotos: Array.isArray(afterPhotos) ? JSON.stringify(afterPhotos) : (afterPhotos || ''),
      status: 'completed',
      remark: remark || ''
    }
    const result = insert(TABLE_RECORDS, record)
    res.json(success(result))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '创建记录失败' })
  }
})

// 删除记录
router.delete('/records/:id', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
  try {
    const ok = remove(TABLE_RECORDS, req.params.id)
    if (!ok) return res.status(404).json({ code: 404, data: null, message: '记录不存在' })
    res.json(success(null))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '删除记录失败' })
  }
})

// 导出巡检记录
router.get('/export', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate, equipmentType } = req.query
    let list = getAll(TABLE_RECORDS)
    if (startDate) list = list.filter(r => r.inspectionDate >= startDate)
    if (endDate) list = list.filter(r => r.inspectionDate <= endDate + ' 23:59:59')

    const data = list.map(r => ({
      '巡检日期': r.inspectionDate,
      '设备编号': r.equipmentCode,
      '设备名称': r.equipmentName,
      '巡检模板': r.templateName,
      '巡检人': r.inspector,
      '巡检项目': r.items.map(it => `${it.content}: ${it.checked ? '通过' : '不通过'}${it.remark ? '(' + it.remark + ')' : ''}`).join('; '),
      '备注': r.remark || '',
      '创建时间': r.createdAt
    }))
    res.json(success(data))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '导出失败' })
  }
})

module.exports = router