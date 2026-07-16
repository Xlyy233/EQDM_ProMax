/**
 * 照片存储迁移脚本
 * 将 records 和 inspectionRecords 中的 base64 照片转为文件存储
 * 运行方式：node scripts/migrate-photos.js
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'eqdm.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'records');

// 备份
const BACKUP_PATH = DB_PATH.replace('.json', '_backup_before_migrate_' + Date.now() + '.json');

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('数据库文件不存在:', DB_PATH);
    process.exit(1);
  }

  // 备份
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('已备份数据库到:', BACKUP_PATH);

  // 确保上传目录存在
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  let migrated = 0;
  let skipped = 0;

  // 迁移 records 表
  if (db.records) {
    for (const record of db.records) {
      const photoFields = ['photos', 'afterPhotos'];
      for (const field of photoFields) {
        let photos = record[field];
        if (!photos) continue;
        // 解析 JSON 字符串
        if (typeof photos === 'string') {
          try { photos = JSON.parse(photos) } catch { continue; }
        }
        if (!Array.isArray(photos) || photos.length === 0) continue;

        const newPhotos = [];
        for (const p of photos) {
          if (typeof p === 'string' && p.startsWith('data:image/')) {
            // base64 图片 → 写入文件
            const matches = p.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
              const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
              const base64Data = matches[2];
              const fileName = 'mig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
              try {
                fs.writeFileSync(path.join(UPLOADS_DIR, fileName), Buffer.from(base64Data, 'base64'));
                newPhotos.push(fileName);
                migrated++;
              } catch (e) {
                console.error('写入文件失败:', fileName, e.message);
                newPhotos.push(p); // 保留原始 base64
                skipped++;
              }
            } else {
              newPhotos.push(p);
            }
          } else {
            newPhotos.push(p); // 已经是文件名或 URL，保持不变
          }
        }
        record[field] = newPhotos;
      }
    }
  }

  // 迁移 inspectionRecords 表
  if (db.inspectionRecords) {
    for (const ir of db.inspectionRecords) {
      const photoFields = ['photos', 'afterPhotos'];
      for (const field of photoFields) {
        let photos = ir[field];
        if (!photos) continue;
        if (typeof photos === 'string') {
          try { photos = JSON.parse(photos) } catch { continue; }
        }
        if (!Array.isArray(photos) || photos.length === 0) continue;

        const newPhotos = [];
        for (const p of photos) {
          if (typeof p === 'string' && p.startsWith('data:image/')) {
            const matches = p.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
              const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
              const base64Data = matches[2];
              const fileName = 'mig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
              try {
                fs.writeFileSync(path.join(UPLOADS_DIR, fileName), Buffer.from(base64Data, 'base64'));
                newPhotos.push(fileName);
                migrated++;
              } catch (e) {
                console.error('写入文件失败:', fileName, e.message);
                newPhotos.push(p);
                skipped++;
              }
            } else {
              newPhotos.push(p);
            }
          } else {
            newPhotos.push(p);
          }
        }
        ir[field] = newPhotos;
      }
    }
  }

  // 写入数据库
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`迁移完成！成功: ${migrated} 张，跳过: ${skipped} 张`);
  console.log('已更新数据库:', DB_PATH);
  console.log('备份文件:', BACKUP_PATH);
}

main();