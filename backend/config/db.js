const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'eqdm.db');

if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
}

const db = new Database(dbFile);

// 开启 WAL 模式，提升并发读性能
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// 建表：collection + id 为主键，data 存 JSON 字符串
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT,
    updatedAt TEXT,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX IF NOT EXISTS idx_collections_collection ON collections(collection);
`);

// 预编译语句（性能优化）
const stmtGetAll = db.prepare('SELECT id, data, createdAt, updatedAt FROM collections WHERE collection = ?');
const stmtGetById = db.prepare('SELECT id, data, createdAt, updatedAt FROM collections WHERE collection = ? AND id = ?');
const stmtInsert = db.prepare('INSERT OR REPLACE INTO collections (collection, id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
const stmtDeleteById = db.prepare('DELETE FROM collections WHERE collection = ? AND id = ?');
const stmtDeleteAll = db.prepare('DELETE FROM collections WHERE collection = ?');
const stmtCount = db.prepare('SELECT COUNT(*) as cnt FROM collections WHERE collection = ?');

// 默认表名列表（用于 readDB 兼容）
const DEFAULT_TABLES = [
  'users', 'equipments', 'records', 'maintenancePlans', 'attachments',
  'knowledge', 'knowledge_comments', 'knowledge_likes', 'notifications',
  'inspectionTemplates', 'inspectionRecords', 'spareParts', 'sparePartLogs',
  'announcements', 'fileShares'
];

// ========== 工具函数 ==========

function now() {
  const d = new Date();
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace('T', ' ').slice(0, 19);
}

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function likeMatch(value, keyword) {
  if (!value) return false;
  return String(value).toLowerCase().includes(String(keyword).toLowerCase());
}

function paginate(list, page, pageSize) {
  const p = parseInt(page) || 1;
  const ps = parseInt(pageSize) || 20;
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);
  return { page: p, pageSize: ps, total, list: items };
}

function _rowToItem(row) {
  const item = JSON.parse(row.data);
  item.id = row.id;
  item.createdAt = row.createdAt;
  item.updatedAt = row.updatedAt;
  return item;
}

// ========== 兼容旧 API ==========

// readDB 用于 init-db.js 等调用方，返回旧格式 { tableName: [...] }
function readDB() {
  const result = {};
  for (const table of DEFAULT_TABLES) {
    result[table] = getAll(table);
  }
  return result;
}

// writeDB 不再需要，保留空实现兼容
function writeDB() {}

// ========== CRUD 操作 ==========

function getAll(table) {
  const rows = stmtGetAll.all(table);
  return rows.map(_rowToItem);
}

function setAll(table, list) {
  const insertAll = db.transaction((items) => {
    stmtDeleteAll.run(table);
    for (const item of items) {
      const id = item.id || genId(table.slice(0, 1));
      const ts = item.createdAt || now();
      const uts = item.updatedAt || ts;
      const data = { ...item };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      stmtInsert.run(table, id, JSON.stringify(data), ts, uts);
    }
  });
  insertAll(list);
}

function findById(table, id) {
  const row = stmtGetById.get(table, id);
  return row ? _rowToItem(row) : null;
}

function findBy(table, predicate) {
  return getAll(table).find(predicate) || null;
}

function insert(table, item) {
  const id = item.id || genId(table.slice(0, 1));
  const ts = item.createdAt || now();
  const uts = item.updatedAt || ts;
  const data = { ...item };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  stmtInsert.run(table, id, JSON.stringify(data), ts, uts);
  return { id, ...data, createdAt: ts, updatedAt: uts };
}

function batchInsert(table, items) {
  const ts = now();
  const insertAll = db.transaction((list) => {
    const results = [];
    for (const item of list) {
      const id = item.id || genId(table.slice(0, 1));
      const ct = item.createdAt || ts;
      const ut = item.updatedAt || ts;
      const data = { ...item };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      stmtInsert.run(table, id, JSON.stringify(data), ct, ut);
      results.push({ id, ...data, createdAt: ct, updatedAt: ut });
    }
    return results;
  });
  return insertAll(items);
}

function update(table, id, updates) {
  const existing = findById(table, id);
  if (!existing) return null;
  const merged = { ...existing, ...updates, updatedAt: now() };
  const data = { ...merged };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  stmtInsert.run(table, id, JSON.stringify(data), merged.createdAt, merged.updatedAt);
  return merged;
}

function remove(table, id) {
  const info = stmtDeleteById.run(table, id);
  return info.changes > 0;
}

function count(table, predicate) {
  if (!predicate) {
    const row = stmtCount.get(table);
    return row ? row.cnt : 0;
  }
  return getAll(table).filter(predicate).length;
}

function filter(table, predicate) {
  return getAll(table).filter(predicate);
}

function sum(table, predicate, field) {
  const list = getAll(table).filter(predicate);
  return list.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
}

function clear(table) {
  stmtDeleteAll.run(table);
}

module.exports = {
  readDB,
  writeDB,
  dbFile,
  now,
  genId,
  likeMatch,
  paginate,
  getAll,
  setAll,
  findById,
  findBy,
  insert,
  batchInsert,
  update,
  remove,
  count,
  filter,
  sum,
  clear
};