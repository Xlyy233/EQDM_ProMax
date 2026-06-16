<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { roleMap } from '@/types'
import type { User } from '@/types'
import * as userApi from '@/api/user'

const keyword = ref('')
const list = ref<User[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const form = ref({
  id: '', username: '', password: '', realName: '', role: 'employee' as string, department: ''
})

function loadData() {
  loading.value = true
  userApi.getUsers({ page: page.value, pageSize: pageSize.value, keyword: keyword.value }).then(res => {
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  }).catch(() => {}).finally(() => { loading.value = false })
}

function handleSearch() { page.value = 1; loadData() }
function handlePageChange(p: number) { page.value = p; loadData() }
function handleSizeChange(s: number) { pageSize.value = s; page.value = 1; loadData() }

function openAdd() {
  isEdit.value = false
  form.value = { id: '', username: '', password: '', realName: '', role: 'employee', department: '' }
  dialogVisible.value = true
}

function openEdit(user: User) {
  isEdit.value = true
  form.value = { id: user.id, username: user.username, password: '', realName: user.realName, role: user.role, department: user.department }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!form.value.username || !form.value.realName || (!isEdit.value && !form.value.password)) {
    ElMessage.warning('请填写完整信息')
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { password, id, ...data } = form.value
      await userApi.updateUser(id, data)
      ElMessage.success('更新成功')
    } else {
      await userApi.addUser(form.value as any)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {} finally { submitting.value = false }
}

function handleDelete(id: string) {
  ElMessageBox.confirm('确定删除该用户？', '确认', { type: 'warning' }).then(() => {
    userApi.deleteUser(id).then(() => { ElMessage.success('删除成功'); loadData() }).catch(() => {})
  }).catch(() => {})
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="openAdd"><el-icon><Plus /></el-icon>新增用户</el-button>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:8px;">
      <el-input v-model="keyword" placeholder="搜索用户名/姓名" clearable style="max-width:260px;" @clear="handleSearch" @keyup.enter="handleSearch">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button @click="handleSearch">搜索</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe empty-text="暂无用户">
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="realName" label="姓名" min-width="100" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">{{ roleMap[row.role] || row.role }}</template>
      </el-table-column>
      <el-table-column prop="department" label="部门" min-width="100" />
      <el-table-column prop="createdAt" label="创建时间" min-width="120" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @current-change="handlePageChange" @size-change="handleSizeChange" />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="480px" :close-on-click-modal="false">
      <el-form :model="form" label-width="80px" :disabled="submitting">
        <el-form-item label="用户名" required><el-input v-model="form.username" :disabled="isEdit" /></el-form-item>
        <el-form-item label="密码" :required="!isEdit">
          <el-input v-model="form.password" type="password" :placeholder="isEdit ? '留空则不修改' : '请输入密码'" show-password />
        </el-form-item>
        <el-form-item label="姓名" required><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%;">
            <el-option label="普通员工" value="employee" />
            <el-option label="部门经理" value="manager" />
            <el-option label="系统管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门"><el-input v-model="form.department" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>