/**
 * JSON → SQLite 数据迁移脚本
 * 用法: node scripts/migrate-to-sqlite.js
 * 1. 自动备份原 eqdm.json
 * 2. 读取 JSON 数据，写入 SQLite
 * 3. 验证迁移结果
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const jsonFile = path.join(dataDir, 'eqdm.json');
const dbFile = path.join(dataDir, 'eqdm.db');

console.log('========================================');
console.log('  JSON → SQLite 数据迁移');
console.log('========================================\n');

// 1. 检查 JSON 文件
if (!fs.existsSync(jsonFile)) {
  console.log('[跳过] 未找到 eqdm.json，无需迁移');
  process.exit(0);
}

// 2. 备份原文件
const backupDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date(new Date().getTime() + 8 * 60 * 60 * 1000)
  .toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
const backupFile = path.join(backupDir, `eqdm_before_sqlite_${timestamp}.json`);
fs.copyFileSync(jsonFile, backupFile);
console.log(`[备份] ${backupFile}`);

// 3. 读取 JSON 数据
const raw = fs.readFileSync(jsonFile, 'utf-8');
const data = JSON.parse(raw);
console.log(`[读取] JSON 文件大小: ${(raw.length / 1024).toFixed(1)} KB`);

// 4. 初始化 SQLite（直接引用 db.js 会自动建表）
const db = require('../config/db');

// 5. 写入数据
let totalRows = 0;
const tables = Object.keys(data).filter(k => Array.isArray(data[k]));

for (const table of tables) {
  const items = data[table];
  if (items.length === 0) continue;
  
  db.setAll(table, items);
  totalRows += items.length;
  console.log(`[写入] ${table}: ${items.length} 条`);
}

console.log(`\n[完成] 共迁移 ${totalRows} 条记录到 SQLite`);

// 6. 验证
console.log('\n--- 验证迁移结果 ---');
for (const table of tables) {
  const count = db.count(table);
  const expected = data[table].length;
  const status = count === expected ? '✓' : '✗ 不一致!';
  console.log(`  ${status} ${table}: ${count} 条 (期望 ${expected})`);
}

// 7. 重命名旧 JSON 文件（保留但不使用）
const retiredFile = jsonFile.replace('.json', '_retired.json');
fs.renameSync(jsonFile, retiredFile);
console.log(`\n[归档] ${path.basename(jsonFile)} → ${path.basename(retiredFile)}`);
console.log('\n迁移完成！系统将自动使用 SQLite 数据库。');
console.log('如需回滚，删除 eqdm.db 并将 _retired.json 改回 eqdm.json 即可。');