const express = require('express')
const fs = require('fs')
const path = require('path')
const { authMiddleware } = require('../middleware/auth')
const { success } = require('../utils/helper')

const router = express.Router()
const LOG_DIR = path.join(__dirname, '..', 'logs')

// 读取日志文件列表
router.get('/', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.json(success({ total: 0, list: [] }))
    }

    let files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse()

    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20

    let allLines = []
    for (const file of files.slice(0, 5)) {
      const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8')
      const lines = content.trim().split('\n').reverse()
      allLines.push(...lines.map(line => {
        const match = line.match(/^\[(.+?)\]\s+\[(\w+)\]\s+(.+)$/)
        if (match) {
          return {
            time: match[1],
            level: match[2].toLowerCase(),
            message: match[3]
          }
        }
        return null
      }).filter(Boolean))
    }

    const total = allLines.length
    const start = (page - 1) * pageSize
    const list = allLines.slice(start, start + pageSize)

    res.json(success({ total, list }))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '读取日志失败' })
  }
})

module.exports = router