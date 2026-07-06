<script setup lang="ts">
import { ref, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Camera } from '@element-plus/icons-vue'
import jsQR from 'jsqr'

const router = useRouter()
const scanning = ref(false)
const stream = ref<MediaStream | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const manualCode = ref('')
const errorMsg = ref('')
const showActionDialog = ref(false)
const scannedEquipmentId = ref('')
const scannedEquipmentName = ref('')

let scanTimer: number | null = null

function parseUrlParams(url: string) {
  try {
    const u = new URL(url)
    const equipmentId = u.searchParams.get('equipmentId')
    const equipmentName = u.searchParams.get('equipmentName')
    if (equipmentId) {
      return { equipmentId, equipmentName: equipmentName || '' }
    }
  } catch {}
  return null
}

function handleScanResult(result: string) {
  stopScanning()
  const params = parseUrlParams(result)
  if (params) {
    scannedEquipmentId.value = params.equipmentId
    scannedEquipmentName.value = params.equipmentName || ''
    showActionDialog.value = true
  } else {
    ElMessage.warning('无法识别的二维码内容，请扫描设备二维码')
    scanning.value = false
  }
}

function scanCanvas() {
  if (!scanning.value || !videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Match canvas size to video
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert'
  })

  if (code) {
    handleScanResult(code.data)
    return
  }

  if (scanning.value) {
    scanTimer = window.setTimeout(scanCanvas, 200)
  }
}

async function startScanning() {
  errorMsg.value = ''

  try {
    // Open camera
    const s = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    })
    stream.value = s
    scanning.value = true

    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = s
      await videoRef.value.play()

      // Wait a frame for video to have dimensions
      await new Promise(resolve => setTimeout(resolve, 500))
      scanCanvas()
    }
  } catch (e: any) {
    if (e.name === 'NotAllowedError') {
      errorMsg.value = '请允许浏览器使用摄像头权限'
    } else if (e.name === 'NotFoundError') {
      errorMsg.value = '未检测到摄像头设备'
    } else {
      errorMsg.value = e.message || '无法打开摄像头'
    }
    scanning.value = false
  }
}

function stopScanning() {
  scanning.value = false
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }
  if (stream.value) {
    stream.value.getTracks().forEach(t => t.stop())
    stream.value = null
  }
}

function handleManualSubmit() {
  if (!manualCode.value.trim()) {
    ElMessage.warning('请输入二维码内容')
    return
  }
  handleScanResult(manualCode.value.trim())
}

onUnmounted(stopScanning)

function goToRecord() {
  showActionDialog.value = false
  router.push('/record/new?equipmentId=' + encodeURIComponent(scannedEquipmentId.value) + '&equipmentName=' + encodeURIComponent(scannedEquipmentName.value))
}

function goToDetail() {
  showActionDialog.value = false
  router.push('/equipment/' + scannedEquipmentId.value)
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <el-button text @click="router.back()"><el-icon><ArrowLeft /></el-icon></el-button>
        <h2 class="page-title">扫码填报</h2>
      </div>
    </div>

    <div class="stat-card" style="padding:24px;max-width:600px;margin:0 auto;">
      <!-- 摄像头扫码区域 -->
      <div style="text-align:center;">
        <div v-if="errorMsg" style="margin-bottom:16px;">
          <el-alert :title="errorMsg" type="warning" :closable="false" show-icon />
        </div>

        <div
          v-if="scanning"
          style="position:relative;display:inline-block;border-radius:12px;overflow:hidden;border:2px solid #409EFF;"
        >
          <video ref="videoRef" style="width:100%;max-width:400px;display:block;" autoplay playsinline muted />
          <canvas ref="canvasRef" style="display:none;" />
          <div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border:2px dashed #409EFF;border-radius:8px;" />
          </div>
          <div style="position:absolute;bottom:12px;left:0;right:0;text-align:center;color:#fff;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,0.6);">
            将二维码对准框内扫码
          </div>
        </div>

        <div v-if="!scanning" style="padding:40px 0;">
          <el-icon :size="64" color="#c0c4cc"><Camera /></el-icon>
          <p style="color:#909399;margin-top:12px;">点击下方按钮开启摄像头扫码</p>
          <el-button type="primary" size="large" @click="startScanning" style="margin-top:12px;">
            <el-icon><Camera /></el-icon> 开始扫码
          </el-button>
        </div>

        <el-button v-if="scanning" type="danger" @click="stopScanning" style="margin-top:12px;">停止扫码</el-button>
      </div>

      <!-- 操作选择弹窗 -->
    <el-dialog v-model="showActionDialog" title="请选择操作" width="300px" :close-on-click-modal="false">
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0;">
        <el-button type="primary" size="large" @click="goToRecord">
          <el-icon><Edit /></el-icon> 填报记录
        </el-button>
        <el-button size="large" @click="goToDetail">
          <el-icon><View /></el-icon> 查看设备详情
        </el-button>
      </div>
    </el-dialog>

    <!-- 手动输入区域 -->
      <el-divider style="margin:24px 0;">手动输入</el-divider>
      <div style="display:flex;gap:8px;">
        <el-input
          v-model="manualCode"
          placeholder="粘贴二维码内容"
          clearable
          @keyup.enter="handleManualSubmit"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleManualSubmit">查询</el-button>
      </div>
    </div>
  </div>
</template>