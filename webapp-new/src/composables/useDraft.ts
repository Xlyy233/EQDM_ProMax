/**
 * 表单草稿保护 composable
 * 提供 localStorage 自动保存、恢复提示、离开拦截
 */
import { watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { ElMessageBox } from 'element-plus'

export function useDraft<T extends Record<string, any>>(
  form: Ref<T>,
  draftKey: string,
  isEdit: Ref<boolean>,
  submitting: Ref<boolean>
) {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function saveDraft() {
    const hasContent = Object.values(form.value).some(v => {
      if (v === null || v === undefined || v === '') return false
      if (Array.isArray(v)) return v.length > 0
      return true
    })
    if (hasContent) {
      localStorage.setItem(draftKey, JSON.stringify({ form: form.value, timestamp: Date.now() }))
    }
  }

  function clearDraft() {
    localStorage.removeItem(draftKey)
  }

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    const hasContent = Object.values(form.value).some(v => {
      if (v === null || v === undefined || v === '') return false
      if (Array.isArray(v)) return v.length > 0
      return true
    })
    if (hasContent && !submitting.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  // 防抖保存
  watch(form, () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveDraft, 500)
  }, { deep: true })

  onMounted(() => {
    if (!isEdit.value) {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        try {
          const draft = JSON.parse(raw)
          if (Date.now() - draft.timestamp < 24 * 3600 * 1000) {
            ElMessageBox.confirm('检测到上次未完成的记录，是否恢复？', '恢复草稿', {
              confirmButtonText: '恢复',
              cancelButtonText: '不恢复'
            }).then(() => {
              Object.assign(form.value, draft.form)
            }).catch(() => {
              clearDraft()
            })
          } else {
            clearDraft()
          }
        } catch { clearDraft() }
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return { clearDraft, saveDraft }
}