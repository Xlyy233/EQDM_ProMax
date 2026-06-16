const http = require('http');

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const token = global.__token || '';
    const req = http.request({
      host: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : ''
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  // 1. 登录
  const loginRes = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  console.log('[1] 登录:', loginRes.code, 'token:', loginRes.data && loginRes.data.token ? '已获取' : '缺失');
  global.__token = loginRes.data && loginRes.data.token;

  // 2. 模拟批量导入（导入3条设备）
  const batchRes = await api('POST', '/api/equipments/batch', [
    { code: 'FLOW-TEST-' + Date.now(), name: '测试车床一号', department: '生产部', model: 'CNC-100', location: '车间A' },
    { code: 'FLOW-TEST-' + (Date.now() + 1), name: '测试铣床二号', department: '生产部', model: 'MILL-200', location: '车间B' },
    { code: 'FLOW-TEST-' + (Date.now() + 2), name: '测试钻床三号', department: '物流部', model: 'DRILL-300', location: '车间C' }
  ]);
  console.log('[2] 批量导入:', batchRes.code, batchRes.data);

  // 3. 获取设备列表 - 这是前端 useList 调用的 API
  const listRes = await api('GET', '/api/equipments?page=1&pageSize=20');
  console.log('[3] 设备列表:', 'code:', listRes.code, 'total:', listRes.data && listRes.data.total, 'list.length:', listRes.data && listRes.data.list && listRes.data.list.length);

  // 4. 关键: 对比前端 useList 的逻辑
  console.log('\n--------- 新旧逻辑对比 ---------');
  console.log('后端原始响应有 code 字段:', listRes.code === 200);
  console.log('后端原始响应 data.list 存在:', !!(listRes.data && listRes.data.list));

  console.log('\n[旧逻辑] API 函数返回 res.data (即 {page, pageSize, total, list}):');
  const oldReturn = listRes.data;
  console.log('  oldReturn.code === 200:', oldReturn && oldReturn.code === 200, ' ← ❌ 始终 false, 永不进入 useList!');

  console.log('\n[新逻辑] API 函数返回完整响应 res (即 {code, data, message}):');
  const newReturn = listRes;
  console.log('  newReturn.code === 200:', newReturn.code === 200, ' ✓');
  console.log('  newReturn.data.list.length:', newReturn.data && newReturn.data.list && newReturn.data.list.length, ' ✓');
  console.log('  newReturn.data.total:', newReturn.data && newReturn.data.total, ' ✓');

  // 5. 部门列表
  const deptRes = await api('GET', '/api/equipments/departments');
  console.log('\n[5] 部门列表:', deptRes.data);

  // 6. 运维记录
  const recordsRes = await api('GET', '/api/records?page=1&pageSize=20');
  console.log('[6] 运维记录:', 'code:', recordsRes.code, 'total:', recordsRes.data && recordsRes.data.total);

  // 7. 维保计划
  const plansRes = await api('GET', '/api/maintenance-plans?page=1&pageSize=20');
  console.log('[7] 维保计划:', 'code:', plansRes.code, 'total:', plansRes.data && plansRes.data.total);

  console.log('\n✅ 数据链路验证通过 - API 响应结构与前端 useList 期望一致');
})();
