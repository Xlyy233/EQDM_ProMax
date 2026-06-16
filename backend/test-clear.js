const http = require('http');

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
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
  try {
    // 1. 登录
    const loginRes = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    console.log('[1] 登录:', loginRes.code, loginRes.data ? '✓' : '✗');
    const token = loginRes.data && loginRes.data.token;

    // 2. 先查一下当前设备数量和记录数量
    const listRes = await api('GET', '/api/equipments?page=1&pageSize=1000', null, token);
    const recordsRes = await api('GET', '/api/records?page=1&pageSize=1000', null, token);
    console.log('[2] 当前设备数量:', listRes.data && listRes.data.total);
    console.log('[3] 当前运维记录数量:', recordsRes.data && recordsRes.data.total);

    // 4. 尝试清空所有设备
    console.log('[4] 调用 DELETE /api/equipments/all ...');
    const clearRes = await api('DELETE', '/api/equipments/all', null, token);
    console.log('    响应:', JSON.stringify(clearRes));

    if (clearRes.code === 200) {
      console.log('    ✓ 清空成功');
      // 验证
      const verifyRes = await api('GET', '/api/equipments?page=1&pageSize=20', null, token);
      console.log('[5] 验证 - 清空后设备数量:', verifyRes.data && verifyRes.data.total);
    } else {
      console.log('    ✗ 清空失败:', clearRes.message);
      // 如果是因为有记录，尝试先删除记录
      if (clearRes.message && clearRes.message.includes('运维记录')) {
        console.log('[6] 存在关联记录，尝试先清空记录...');
        // 这里没有记录批量删除接口，先看看情况
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
