<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as notificationApi from '@/api/notification'
import type { NotificationItem } from '@/api/notification'
import dayjs from 'dayjs'

defineProps<{ light?: boolean }>()

const router = useRouter()
const unreadCount = ref(0)
const showPopover = ref(false)
const notifications = ref<NotificationItem[]>([])
const pollingTimer = ref<ReturnType<typeof setInterval> | null>(null)
let notifiedIds = new Set<string>()

// ========== 标题闪烁 ==========
const originalTitle = document.title
let titleFlashTimer: ReturnType<typeof setInterval> | null = null
let titleToggle = false

function startTitleFlash(count: number) {
  if (titleFlashTimer) return
  titleToggle = false
  titleFlashTimer = setInterval(() => {
    titleToggle = !titleToggle
    document.title = titleToggle ? `【${count}条新通知】${originalTitle}` : originalTitle
  }, 1500)
}

function stopTitleFlash() {
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer)
    titleFlashTimer = null
  }
  document.title = originalTitle
}

// ========== Favicon 角标 ==========
const originalFavicon = (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href || '/favicon.ico'
let faviconImage: HTMLImageElement | null = null

function createBadgedFavicon(): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!

    // 尝试加载原始 favicon
    if (faviconImage) {
      ctx.drawImage(faviconImage, 0, 0, 32, 32)
    } else {
      // 降级：纯色背景
      ctx.fillStyle = '#409EFF'
      ctx.beginPath()
      ctx.arc(16, 16, 16, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制红色角标圆点
    ctx.fillStyle = '#EF4444'
    ctx.beginPath()
    ctx.arc(26, 6, 8, 0, Math.PI * 2)
    ctx.fill()

    // 白色数字
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(unreadCount.value > 99 ? '99' : String(unreadCount.value), 26, 7)

    resolve(canvas.toDataURL('image/png'))
  })
}

function setBadgedFavicon(dataUrl: string) {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = dataUrl
}

function restoreFavicon() {
  const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  if (link) {
    link.href = originalFavicon
  }
}

// ========== 数据获取 ==========
function formatTime(dateStr: string) {
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffMin = now.diff(d, 'minute')
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = now.diff(d, 'hour')
  if (diffHour < 24) return `${diffHour}小时前`
  return d.format('MM-DD HH:mm')
}

async function fetchNotifications() {
  try {
    const res = await notificationApi.getUnread()
    const prevCount = unreadCount.value
    unreadCount.value = res.data.unreadCount
    notifications.value = res.data.list.slice(0, 20)

    const hasNewItems = res.data.list.some(n => !notifiedIds.has(n.id))

    // 桌面通知 + 振动：有新增未读通知
    if (res.data.list.length > 0 && hasNewItems) {
      // 手机振动（需用户已交互）
      if (navigator.vibrate && navigator.userActivation?.hasBeenActive) {
        try { navigator.vibrate(200) } catch {}
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        for (const n of res.data.list) {
          if (!notifiedIds.has(n.id)) {
            notifiedIds.add(n.id)
            new Notification(n.title, {
              body: n.content,
              icon: '/favicon.ico',
              tag: n.id
            })
          }
        }
      }
    }
  } catch {}
}

// ========== 标题 + Favicon 联动 ==========
watch(unreadCount, (count) => {
  if (count > 0) {
    startTitleFlash(count)
    createBadgedFavicon().then(setBadgedFavicon)
  } else {
    stopTitleFlash()
    restoreFavicon()
  }
})

function startPolling() {
  fetchNotifications()
  pollingTimer.value = setInterval(fetchNotifications, 30000)
}

function stopPolling() {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

async function handleClickNotification(item: NotificationItem) {
  showPopover.value = false
  try {
    await notificationApi.markRead(item.id)
  } catch {}
  unreadCount.value = Math.max(0, unreadCount.value - 1)
  if (item.targetUrl) {
    router.push(item.targetUrl)
  }
}

async function handleMarkAllRead() {
  try {
    await notificationApi.markAllRead()
    unreadCount.value = 0
    notifications.value = notifications.value.map(n => ({ ...n, read: true }))
    ElMessage.success('已全部标记为已读')
  } catch {}
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

onMounted(() => {
  requestNotificationPermission()
  // 预加载 favicon 图片供 canvas 使用
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { faviconImage = img }
  img.src = originalFavicon
  startPolling()
})

onUnmounted(() => {
  stopPolling()
  stopTitleFlash()
  restoreFavicon()
})
</script>

<template>
  <el-popover
    v-model:visible="showPopover"
    placement="bottom-end"
    :width="360"
    trigger="click"
    popper-class="notification-popover"
  >
    <template #reference>
      <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="notification-badge">
        <el-button link class="notification-btn" :class="{ light: light }">
          <el-icon :size="20"><Bell /></el-icon>
        </el-button>
      </el-badge>
    </template>

    <div class="notification-panel">
      <div class="notification-header">
        <span class="notification-title">消息通知</span>
        <el-button
          v-if="unreadCount > 0"
          link
          type="primary"
          size="small"
          @click="handleMarkAllRead"
        >全部已读</el-button>
      </div>

      <div v-if="notifications.length === 0" class="notification-empty">
        <el-empty :image-size="60" description="暂无通知" />
      </div>

      <div v-else class="notification-list">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ unread: !item.read }"
          @click="handleClickNotification(item)"
        >
          <div class="notification-dot" v-if="!item.read"></div>
          <div class="notification-content">
            <div class="notification-item-title">{{ item.title }}</div>
            <div class="notification-item-text">{{ item.content }}</div>
            <div class="notification-item-time">{{ formatTime(item.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.notification-btn {
  color: #606266;
  font-size: 20px;
  padding: 4px;
}
.notification-btn:hover {
  color: #409EFF;
}
.notification-btn.light {
  color: rgba(255,255,255,0.85);
}
.notification-btn.light:hover {
  color: #fff;
}
.notification-badge :deep(.el-badge__content) {
  transform: translate(6px, -2px);
}
</style>

<style>
.notification-popover {
  padding: 0 !important;
}
.notification-panel {
  max-height: 420px;
  display: flex;
  flex-direction: column;
}
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}
.notification-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.notification-empty {
  padding: 24px 0;
}
.notification-list {
  overflow-y: auto;
  max-height: 360px;
}
.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f7fa;
  transition: background 0.15s;
}
.notification-item:hover {
  background: #f5f7fa;
}
.notification-item.unread {
  background: #f0f6ff;
}
.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409EFF;
  margin-top: 6px;
  margin-right: 10px;
  flex-shrink: 0;
}
.notification-content {
  flex: 1;
  min-width: 0;
}
.notification-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}
.notification-item-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.notification-item-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 6px;
}
</style>