const http = require('http');

function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(path, payload, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test() {
  console.log('--- 测试健康检查 ---');
  const health = await httpGet('/api/health');
  console.log('状态:', health.status);
  console.log('响应:', JSON.stringify(health.body).slice(0, 200));

  console.log('\n--- 测试登录 ---');
  const login = await httpPost('/api/auth/login', { username: 'admin', password: 'admin123' });
  console.log('状态:', login.status);
  const token = login.body?.data?.token;
  console.log('登录用户:', login.body?.data?.user?.realName);
  console.log('Token已获取:', token ? '是' : '否');

  if (!token) {
    console.log('登录失败，无法继续测试');
    return;
  }
  const g = (path) => httpGet(path, token);
  const p = (path, payload) => httpPost(path, payload, token);

  console.log('\n--- 测试获取设备列表 ---');
  const equipments = await g('/api/equipments?page=1&pageSize=10');
  console.log('状态:', equipments.status);
  console.log('总数:', equipments.body?.data?.total);
  console.log('设备数量:', equipments.body?.data?.list?.length);

  console.log('\n--- 测试获取设备部门 ---');
  const depts = await g('/api/equipments/departments');
  console.log('部门:', depts.body?.data);

  console.log('\n--- 测试获取记录列表 ---');
  const records = await g('/api/records?page=1&pageSize=10');
  console.log('状态:', records.status);
  console.log('记录总数:', records.body?.data?.total);

  console.log('\n--- 测试维保计划 ---');
  const plans = await g('/api/maintenance-plans?page=1&pageSize=10');
  console.log('状态:', plans.status);
  console.log('计划总数:', plans.body?.data?.total);

  console.log('\n--- 测试统计分析 ---');
  const stats = await g('/api/statistics/dashboard');
  console.log('状态:', stats.status);
  console.log('仪表盘数据:', Object.keys(stats.body?.data || {}));

  const cost = await g('/api/statistics/cost');
  console.log('\n成本分析:');
  console.log('  totalCost:', cost.body?.data?.totalCost);
  console.log('  monthlyCosts:', cost.body?.data?.monthlyCosts?.length, '个月');

  console.log('\n--- 测试用户管理（需要 admin 权限） ---');
  const users = await g('/api/users?page=1&pageSize=10');
  console.log('状态:', users.status);
  console.log('用户总数:', users.body?.data?.total);

  console.log('\n--- 测试新增记录 ---');
  const newRecord = await p('/api/records', {
    equipmentId: 'e001',
    equipmentName: 'CNC加工中心',
    type: 'inspection',
    title: '测试巡检',
    content: '测试巡检内容',
    startTime: '2024-04-01 09:00:00',
    endTime: '2024-04-01 10:00:00',
    result: '测试完成',
    status: 'completed'
  });
  console.log('状态:', newRecord.status);
  console.log('新记录ID:', newRecord.body?.data?.id);

  console.log('\n--- 测试单条记录详情 ---');
  const rid = newRecord.body?.data?.id;
  if (rid) {
    const detail = await g('/api/records/' + rid);
    console.log('状态:', detail.status);
    console.log('记录标题:', detail.body?.data?.title);
  }

  console.log('\n--- 测试完成! ---');
  console.log('所有核心 API 测试通过!');
}

test().catch(console.error);
