require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

function seedIfEmpty() {
  const userCount = db.count('users');
  if (userCount > 0) {
    console.log('已有初始数据 (' + userCount + ' 个用户)，跳过种子数据插入');
    return;
  }

  const now = db.now();

  const users = [
    { id: 'u001', username: 'admin', password: bcrypt.hashSync('admin123', 10), realName: '系统管理员', role: 'admin', department: '信息部', createdAt: now, updatedAt: now },
    { id: 'u002', username: 'manager', password: bcrypt.hashSync('manager123', 10), realName: '张经理', role: 'manager', department: '生产部', createdAt: now, updatedAt: now },
    { id: 'u003', username: 'zhangsan', password: bcrypt.hashSync('123456', 10), realName: '张三', role: 'employee', department: '生产部', createdAt: now, updatedAt: now },
    { id: 'u004', username: 'lisi', password: bcrypt.hashSync('123456', 10), realName: '李四', role: 'employee', department: '物流部', createdAt: now, updatedAt: now },
    { id: 'u005', username: 'wangwu', password: bcrypt.hashSync('123456', 10), realName: '王五', role: 'employee', department: '生产部', createdAt: now, updatedAt: now },
    { id: 'u006', username: 'sa', password: bcrypt.hashSync('123456', 10), realName: '普通员工', role: 'employee', department: '生产部', createdAt: now, updatedAt: now }
  ];
  users.forEach(u => db.insert('users', u));

  const equipments = [
    { id: 'e001', code: 'EQ-001', name: 'CNC加工中心', model: 'VMC850', purchaseDate: '2023-01-15', department: '生产部', location: '车间A-1号', status: 'in_use', qrcode: 'EQDM-EQ-001', createdBy: 'u001', updatedBy: 'u001' },
    { id: 'e002', code: 'EQ-002', name: '数控车床', model: 'CK6140', purchaseDate: '2023-03-20', department: '生产部', location: '车间A-2号', status: 'in_use', qrcode: 'EQDM-EQ-002', createdBy: 'u001', updatedBy: 'u001' },
    { id: 'e003', code: 'EQ-003', name: '液压剪板机', model: 'QC12Y-6X2500', purchaseDate: '2022-11-10', department: '生产部', location: '车间B-1号', status: 'in_use', qrcode: 'EQDM-EQ-003', createdBy: 'u001', updatedBy: 'u001' },
    { id: 'e004', code: 'EQ-004', name: '激光切割机', model: 'LC-3015', purchaseDate: '2024-02-05', department: '生产部', location: '车间B-2号', status: 'stopped', qrcode: 'EQDM-EQ-004', createdBy: 'u001', updatedBy: 'u001' },
    { id: 'e005', code: 'EQ-005', name: '电动叉车', model: 'CPD30', purchaseDate: '2023-07-12', department: '物流部', location: '仓库A', status: 'in_use', qrcode: 'EQDM-EQ-005', createdBy: 'u001', updatedBy: 'u001' },
    { id: 'e006', code: 'EQ-006', name: '包装流水线', model: 'PK-200', purchaseDate: '2023-09-18', department: '物流部', location: '仓库B', status: 'in_use', qrcode: 'EQDM-EQ-006', createdBy: 'u001', updatedBy: 'u001' }
  ];
  equipments.forEach(e => db.insert('equipments', e));

  const records = [
    { id: 'r001', equipmentId: 'e001', equipmentName: 'CNC加工中心', type: 'maintenance', title: '月度保养', content: '完成月度定期保养，检查主轴、润滑系统', startTime: '2024-03-01 09:00:00', endTime: '2024-03-01 11:30:00', result: '保养完成，设备运行正常', remark: '下次保养日期：2024-04-01', photos: '', status: 'completed', cost: 200, laborCost: 150, partsCost: 50, otherCost: 0, partsReplaced: '', createdBy: 'u003', updatedBy: 'u003' },
    { id: 'r002', equipmentId: 'e001', equipmentName: 'CNC加工中心', type: 'repair', title: '主轴异响维修', content: '主轴出现异响，拆解检查发现轴承磨损', startTime: '2024-03-15 14:00:00', endTime: '2024-03-16 18:00:00', result: '更换轴承后恢复正常', remark: '建议缩短保养周期', photos: '', status: 'completed', cost: 1500, laborCost: 500, partsCost: 800, otherCost: 200, partsReplaced: '主轴轴承x2', createdBy: 'u003', updatedBy: 'u003' },
    { id: 'r003', equipmentId: 'e002', equipmentName: '数控车床', type: 'inspection', title: '日常巡检', content: '检查设备运行状态、润滑油、刀具磨损', startTime: '2024-03-20 08:00:00', endTime: '2024-03-20 09:00:00', result: '设备状态良好', remark: '', photos: '', status: 'completed', cost: 0, laborCost: 0, partsCost: 0, otherCost: 0, partsReplaced: '', createdBy: 'u003', updatedBy: 'u003' },
    { id: 'r004', equipmentId: 'e003', equipmentName: '液压剪板机', type: 'maintenance', title: '液压油更换', content: '更换液压油，清洁过滤器', startTime: '2024-02-20 10:00:00', endTime: '2024-02-20 14:00:00', result: '液压油更换完成', remark: '', photos: '', status: 'completed', cost: 800, laborCost: 200, partsCost: 600, otherCost: 0, partsReplaced: '液压油46号x20L', createdBy: 'u003', updatedBy: 'u003' },
    { id: 'r005', equipmentId: 'e004', equipmentName: '激光切割机', type: 'repair', title: '激光功率不足', content: '激光输出功率下降，影响切割质量', startTime: '2024-03-10 09:00:00', endTime: '2024-03-12 17:00:00', result: '更换激光管后功率恢复，待厂家最终验收', remark: '联系厂家人员进行功率校准', photos: '', status: 'pending', cost: 5000, laborCost: 1000, partsCost: 3500, otherCost: 500, partsReplaced: '激光管x1', createdBy: 'u004', updatedBy: 'u004' },
    { id: 'r006', equipmentId: 'e005', equipmentName: '电动叉车', type: 'maintenance', title: '季度保养', content: '电瓶检查、轮胎检查、制动系统测试', startTime: '2024-03-05 09:00:00', endTime: '2024-03-05 12:00:00', result: '完成季度保养', remark: '', photos: '', status: 'completed', cost: 300, laborCost: 200, partsCost: 100, otherCost: 0, partsReplaced: '', createdBy: 'u004', updatedBy: 'u004' },
    { id: 'r007', equipmentId: 'e006', equipmentName: '包装流水线', type: 'inspection', title: '生产线巡检', content: '检查传送带电机、封口机、打码机', startTime: '2024-03-18 08:30:00', endTime: '2024-03-18 10:00:00', result: '各部件运行正常', remark: '', photos: '', status: 'completed', cost: 0, laborCost: 0, partsCost: 0, otherCost: 0, partsReplaced: '', createdBy: 'u004', updatedBy: 'u004' },
    { id: 'r008', equipmentId: 'e002', equipmentName: '数控车床', type: 'improvement', title: '加装安全防护装置', content: '为卡盘位置加装安全防护门和急停装置', startTime: '2024-03-22 09:00:00', endTime: '2024-03-23 17:00:00', result: '安全改善完成，通过安全验收', remark: '已纳入安全培训材料', photos: '', status: 'approved', cost: 2000, laborCost: 800, partsCost: 1000, otherCost: 200, partsReplaced: '防护门x1,急停按钮x2', createdBy: 'u003', updatedBy: 'u003' }
  ];
  records.forEach(r => db.insert('records', r));

  const plans = [
    { id: 'p001', equipmentId: 'e001', equipmentName: 'CNC加工中心', equipmentCode: 'EQ-001', planName: 'CNC加工中心月度保养', cycleType: 'monthly', cycleValue: 1, lastMaintenanceDate: '2024-03-01', nextMaintenanceDate: '2024-04-01', responsibleUserId: 'u003', responsibleUserName: '张三', status: 'active', remark: '重点关注主轴状态' },
    { id: 'p002', equipmentId: 'e002', equipmentName: '数控车床', equipmentCode: 'EQ-002', planName: '数控车床日常巡检', cycleType: 'weekly', cycleValue: 1, lastMaintenanceDate: '2024-03-20', nextMaintenanceDate: '2024-03-27', responsibleUserId: 'u003', responsibleUserName: '张三', status: 'active', remark: '' },
    { id: 'p003', equipmentId: 'e003', equipmentName: '液压剪板机', equipmentCode: 'EQ-003', planName: '液压剪板机季度保养', cycleType: 'quarterly', cycleValue: 1, lastMaintenanceDate: '2024-02-20', nextMaintenanceDate: '2024-05-20', responsibleUserId: 'u003', responsibleUserName: '张三', status: 'active', remark: '' },
    { id: 'p004', equipmentId: 'e005', equipmentName: '电动叉车', equipmentCode: 'EQ-005', planName: '电动叉车季度保养', cycleType: 'quarterly', cycleValue: 1, lastMaintenanceDate: '2024-03-05', nextMaintenanceDate: '2024-06-05', responsibleUserId: 'u004', responsibleUserName: '李四', status: 'active', remark: '' },
    { id: 'p005', equipmentId: 'e006', equipmentName: '包装流水线', equipmentCode: 'EQ-006', planName: '包装流水线日常巡检', cycleType: 'daily', cycleValue: 1, lastMaintenanceDate: '2024-03-18', nextMaintenanceDate: '2024-03-19', responsibleUserId: 'u004', responsibleUserName: '李四', status: 'active', remark: '' }
  ];
  plans.forEach(p => db.insert('maintenancePlans', p));

  console.log('种子数据插入完成');
  console.log('  - 用户: ' + users.length + ' 个');
  console.log('  - 设备: ' + equipments.length + ' 个');
  console.log('  - 记录: ' + records.length + ' 个');
  console.log('  - 维保计划: ' + plans.length + ' 个');
}

function main() {
  try {
    console.log('初始化数据库...');
    seedIfEmpty();
    console.log('数据库初始化成功! 数据文件: ' + db.dbFile);
    const d = db.readDB();
    console.log('  users: ' + d.users.length);
    console.log('  equipments: ' + d.equipments.length);
    console.log('  records: ' + d.records.length);
    console.log('  maintenancePlans: ' + d.maintenancePlans.length);
  } catch (err) {
    console.error('初始化失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedIfEmpty };
