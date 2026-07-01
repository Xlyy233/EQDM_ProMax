import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { loadFromStorage, isLoggedIn } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/index.vue'), meta: { title: '登录', layout: 'blank' } },
  { path: '/', name: 'Home', component: () => import('@/views/dashboard/index.vue'), meta: { title: '首页', icon: 'HomeFilled' } },
  { path: '/equipment', name: 'Equipment', component: () => import('@/views/equipment/list.vue'), meta: { title: '设备台账', icon: 'Box' } },
  { path: '/equipment/new', name: 'EquipmentNew', component: () => import('@/views/equipment/form.vue'), meta: { title: '新增设备' } },
  { path: '/equipment/:id', name: 'EquipmentDetail', component: () => import('@/views/equipment/detail.vue'), meta: { title: '设备详情' } },
  { path: '/equipment/:id/edit', name: 'EquipmentEdit', component: () => import('@/views/equipment/form.vue'), meta: { title: '编辑设备' } },
  { path: '/equipment-qrcode', name: 'QRCodeManage', component: () => import('@/views/equipment/qrcode.vue'), meta: { title: '二维码管理', icon: 'QrCode' } },
  { path: '/equipment/scan', name: 'EquipmentScan', component: () => import('@/views/equipment/scan.vue'), meta: { title: '扫码识别' } },
  { path: '/record', name: 'Record', component: () => import('@/views/record/list.vue'), meta: { title: '工作记录', icon: 'Document' } },
  { path: '/record/new', name: 'RecordNew', component: () => import('@/views/record/form.vue'), meta: { title: '填报记录' } },
  { path: '/record/:id', name: 'RecordDetail', component: () => import('@/views/record/detail.vue'), meta: { title: '记录详情' } },
  { path: '/record/:id/edit', name: 'RecordEdit', component: () => import('@/views/record/form.vue'), meta: { title: '编辑记录' } },
  { path: '/maintenance', name: 'Maintenance', component: () => import('@/views/maintenance/list.vue'), meta: { title: '保养计划', icon: 'Calendar' } },
  { path: '/maintenance/new', name: 'MaintenanceNew', component: () => import('@/views/maintenance/form.vue'), meta: { title: '新增保养计划' } },
  { path: '/maintenance/calendar', name: 'MaintenanceCalendar', component: () => import('@/views/maintenance/calendar.vue'), meta: { title: '保养日历', icon: 'Date' } },
  { path: '/maintenance/:id', name: 'MaintenanceDetail', component: () => import('@/views/maintenance/detail.vue'), meta: { title: '计划详情' } },
  { path: '/maintenance/:id/edit', name: 'MaintenanceEdit', component: () => import('@/views/maintenance/form.vue'), meta: { title: '编辑保养计划' } },
  { path: '/statistics', name: 'Statistics', component: () => import('@/views/statistics/index.vue'), meta: { title: '统计分析', icon: 'DataAnalysis' } },
  { path: '/knowledge', name: 'Knowledge', component: () => import('@/views/knowledge/index.vue'), meta: { title: '部门知识库', icon: 'Reading' } },
  { path: '/knowledge/new', name: 'KnowledgeNew', component: () => import('@/views/knowledge/form.vue'), meta: { title: '发布知识' } },
  { path: '/knowledge/:id', name: 'KnowledgeDetail', component: () => import('@/views/knowledge/detail.vue'), meta: { title: '知识详情' } },
  { path: '/knowledge/:id/edit', name: 'KnowledgeEdit', component: () => import('@/views/knowledge/form.vue'), meta: { title: '编辑知识' } },
  { path: '/export', name: 'Export', component: () => import('@/views/export/index.vue'), meta: { title: '数据导出', icon: 'Download' } },
  { path: '/user', name: 'UserManage', component: () => import('@/views/user/list.vue'), meta: { title: '用户管理', icon: 'User' } },
  { path: '/template', name: 'Template', component: () => import('@/views/template/list.vue'), meta: { title: '常用模板', icon: 'Collection' } },
  { path: '/logs', name: 'Logs', component: () => import('@/views/logs/index.vue'), meta: { title: '日志管理', icon: 'Tickets' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  loadFromStorage()
  document.title = `${to.meta.title || ''} - 设备管理系统`
  if (to.path === '/login') {
    next()
  } else if (!isLoggedIn()) {
    next('/login')
  } else {
    next()
  }
})

export default router
