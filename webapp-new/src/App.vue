<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MainLayout from '@/components/MainLayout.vue'

const route = useRoute()
const isBlankLayout = computed(() => route.meta.layout === 'blank')
</script>

<template>
  <MainLayout v-if="!isBlankLayout">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </MainLayout>
  <div v-else class="blank-layout">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>

<style scoped>
.blank-layout {
  min-height: 100vh;
}
</style>
