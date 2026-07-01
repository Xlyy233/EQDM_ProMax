const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'eqdm.json');

if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
}

const DEFAULT_DATA = {
  users: [],
  equipments: [],
  records: [],
  maintenancePlans: [],
  attachments: [],
  knowledge: [],
  knowledge_comments: [],
  knowledge_likes: [],
  notifications: []
};

let cache = null;
let lastRead = 0;
const CACHE_TTL = 100;

function readDB() {
  const now = Date.now();
  if (cache && now - lastRead < CACHE_TTL) return cache;
  if (!fs.existsSync(dbFile)) {
    cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
    writeDB(cache);
    return cache;
  }
  try {
    const content = fs.readFileSync(dbFile, 'utf-8');
    const parsed = JSON.parse(content);
    cache = { ...DEFAULT_DATA, ...parsed };
    for (const key of Object.keys(DEFAULT_DATA)) {
      if (!Array.isArray(cache[key])) cache[key] = [];
    }
    lastRead = now;
    return cache;
  } catch (e) {
    console.warn('读取数据库文件失败，使用默认数据:', e.message);
    cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
    return cache;
  }
}

function writeDB(data) {
  try {
    const tmp = dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, dbFile);
    cache = data;
    lastRead = Date.now();
  } catch (e) {
    console.warn('写入数据库文件失败:', e.message);
    cache = data;
    lastRead = Date.now();
  }
}

function now() {
  const d = new Date();
  // UTC+8 北京时间
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

function getAll(table) {
  const db = readDB();
  return db[table] || [];
}

function setAll(table, list) {
  const db = readDB();
  db[table] = list;
  writeDB(db);
}

function findById(table, id) {
  return getAll(table).find(item => item.id === id) || null;
}

function findBy(table, predicate) {
  return getAll(table).find(predicate) || null;
}

function insert(table, item) {
  const list = getAll(table);
  if (!item.id) item.id = genId(table.slice(0, 1));
  if (!item.createdAt) item.createdAt = now();
  if (!item.updatedAt) item.updatedAt = now();
  list.push(item);
  setAll(table, list);
  return item;
}

// 批量插入：一次写盘完成多条记录，避免逐条insert导致的多次磁盘I/O
function batchInsert(table, items) {
  const list = getAll(table);
  const ts = now();
  const results = items.map(item => {
    if (!item.id) item.id = genId(table.slice(0, 1));
    if (!item.createdAt) item.createdAt = ts;
    if (!item.updatedAt) item.updatedAt = ts;
    list.push(item);
    return item;
  });
  setAll(table, list);
  return results;
}

function update(table, id, updates) {
  const list = getAll(table);
  const idx = list.findIndex(item => item.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...updates, updatedAt: now() };
  setAll(table, list);
  return list[idx];
}

function remove(table, id) {
  const list = getAll(table);
  const idx = list.findIndex(item => item.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  setAll(table, list);
  return true;
}

function count(table, predicate) {
  const list = getAll(table);
  if (!predicate) return list.length;
  return list.filter(predicate).length;
}

function filter(table, predicate) {
  return getAll(table).filter(predicate);
}

function sum(table, predicate, field) {
  const list = getAll(table).filter(predicate);
  return list.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
}

function clear(table) {
  setAll(table, []);
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
