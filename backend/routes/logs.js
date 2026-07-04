const express = require('express')
const fs = require('fs')
const path = require('path')
const { authMiddleware } = require('../middleware/auth')
const { success } = require('../utils/helper')

const router = express.Router()
const LOG_DIR = path.join(__dirname, '..', 'logs')

// 请求日志正则：METHOD /path 200 5ms - ::ffff:192.168.1.1
const REQUEST_LOG_RE = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\s+(\d+)ms\s+-\s+(.+)$/

function parseLogLine(line) {
  const match = line.match(/^\[(.+?)\]\s+\[(\w+)\s*\]\s+(.+)$/)
  if (!match) return null

  const time = match[1]
  const level = match[2].toLowerCase()
  const message = match[3]

  // 尝试解析请求日志
  const reqMatch = message.match(REQUEST_LOG_RE)
  if (reqMatch) {
    return {
      time,
      level,
      method: reqMatch[1],
      path: reqMatch[2],
      statusCode: parseInt(reqMatch[3]),
      duration: parseInt(reqMatch[4]),
      ip: reqMatch[5].replace('::ffff:', ''),
      message
    }
  }

  // 非请求日志，保持原样
  return { time, level, message }
}

// 获取可用的日志文件列表
router.get('/files', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.json(success([]))
    }
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log') && /^\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort()
      .reverse()
      .map(f => f.replace('.log', ''))
    res.json(success(files))
  } catch (e) {
    res.status(500).json({ code: 500, data: null, message: '读取日志文件列表失败' })
  }
})

// 读取日志
router.get('/', authMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.json(success({ total: 0, list: [] }))
    }

    const date = req.query.date // 指定日期，如 '2026-07-02'
    const keyword = (req.query.keyword || '').toLowerCase()
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20
    const level = (req.query.level || '').toLowerCase()

    let files = []
    if (date) {
      const filePath = path.join(LOG_DIR, `${date}.log`)
      if (fs.existsSync(filePath)) {
        files = [`${date}.log`]
      }
    } else {
      files = fs.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.log') && /^\d{4}-\d{2}-\d{2}\.log$/.test(f))
        .sort()
        .reverse()
        .slice(0, 5)
    }

    let allLines = []
    for (const file of files) {
      const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8')
      const lines = content.trim().split('\n').reverse()
      for (const line of lines) {
        const parsed = parseLogLine(line)
        if (!parsed) continue

        // 过滤级别
        if (level && parsed.level !== level) continue

        // 过滤关键词
        if (keyword) {
          const searchTarget = parsed.message ? parsed.message.toLowerCase() : ''
          if (!searchTarget.includes(keyword)) continue
        }

        allLines.push(parsed)
      }
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