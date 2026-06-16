<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, loadFromStorage, isLoggedIn } from '@/stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

onMounted(() => {
  loadFromStorage()
  if (isLoggedIn()) {
    router.replace('/')
  }
})

function fillForm(u: string, p: string) {
  username.value = u
  password.value = p
}

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const ok = await login(username.value, password.value)
    if (ok) {
      router.replace('/')
    }
  } catch (e) {
    ElMessage.error('登录异常，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container" style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#E8F4FD 0%,#FFF7E8 50%,#F0FDF4 100%);padding:20px;">
    <div style="width:100%;max-width:420px;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 8px 40px rgba(64,158,255,0.15);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:72px;height:72px;margin:0 auto 16px;background:linear-gradient(135deg,#409EFF,#67C23A);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(64,158,255,0.3);">
          <el-icon :size="36" color="#fff"><Tools /></el-icon>
        </div>
        <h2 style="font-size:26px;font-weight:700;color:#1a1a1a;margin:0 0 4px;">设备管理系统</h2>
        <p style="font-size:14px;color:#909399;margin:0;">设备台账 · 运维管理</p>
      </div>

      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" :disabled="loading" size="large" clearable>
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码" :disabled="loading" size="large" show-password @keyup.enter="handleLogin">
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="handleLogin" style="width:100%;background:linear-gradient(135deg,#409EFF,#67C23A);border:none;font-size:16px;font-weight:600;">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div style="border-top:1px solid #f0f0f0;padding-top:20px;margin-top:8px;">
        <p style="font-size:13px;color:#909399;text-align:center;margin-bottom:12px;">测试账号</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="acc in [
            { role:'管理员', u:'admin', p:'admin123', color:'#409EFF' },
            { role:'部门经理', u:'manager', p:'manager123', color:'#67C23A' },
            { role:'员工共享', u:'sa', p:'123456', color:'#E6A23C' }
          ]" :key="acc.u"
            @click="fillForm(acc.u, acc.p)"
            style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8f9fa;border-radius:10px;cursor:pointer;transition:background 0.2s;">
            <span :style="{color:acc.color,fontSize:'14px',fontWeight:500}">{{ acc.role }}</span>
            <span style="font-size:13px;color:#8a8a8a;font-family:monospace;">{{ acc.u }} / {{ acc.p }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>