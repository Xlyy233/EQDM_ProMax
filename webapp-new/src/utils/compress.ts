/**
 * 图片压缩公共工具
 * 压缩 + 时间戳水印，返回 base64
 */
export interface CompressOptions {
  maxW?: number      // 最大宽度，默认 800
  maxH?: number      // 最大高度，默认 800
  quality?: number   // JPEG 质量 0-1，默认 0.5
  watermark?: boolean // 是否加水印，默认 true
}

export function compressImage(file: File, options: CompressOptions = {}): Promise<string> {
  const { maxW = 800, maxH = 800, quality = 0.5, watermark = true } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let w = img.width
        let h = img.height
        // 等比缩放
        if (w > maxW || h > maxH) {
          if (w / maxW > h / maxH) {
            h = Math.round(h * maxW / w)
            w = maxW
          } else {
            w = Math.round(w * maxH / h)
            h = maxH
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)

        if (watermark) {
          drawWatermark(ctx, w, h)
        }

        const beforeSize = Math.round(file.size / 1024)
        const result = canvas.toDataURL('image/jpeg', quality)
        const afterSize = Math.round(result.length / 1024)
        console.log(`[compress] ${file.name || 'image'}: ${beforeSize}KB → ${afterSize}KB (${w}x${h}, q${quality})`)

        resolve(result)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const text = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const fontSize = Math.max(12, Math.round(w * 0.035))
  const padding = Math.round(w * 0.02)
  ctx.font = `bold ${fontSize}px sans-serif`
  const metrics = ctx.measureText(text)
  const textW = metrics.width
  const textH = fontSize * 1.2
  const x = w - textW - padding * 2
  const y = h - textH - padding * 2

  // 半透明背景条
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  const bgX = x - padding
  const bgY = y - padding
  const bgW = textW + padding * 2
  const bgH = textH + padding * 2
  const radius = Math.round(fontSize * 0.3)
  ctx.beginPath()
  ctx.moveTo(bgX + radius, bgY)
  ctx.lineTo(bgX + bgW - radius, bgY)
  ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + radius)
  ctx.lineTo(bgX + bgW, bgY + bgH - radius)
  ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - radius, bgY + bgH)
  ctx.lineTo(bgX + radius, bgY + bgH)
  ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - radius)
  ctx.lineTo(bgX, bgY + radius)
  ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.fillText(text, x, y)
}