<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import AppTopbar from '@/components/AppTopbar.vue';

const route = useRoute();

const isAppShell = computed(() => Boolean(route.meta.requiresAuth));
const showTopbar = computed(() => isAppShell.value && !route.meta.hideTopbar);
</script>

<template>
  <div :class="isAppShell ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'">
    <AppTopbar v-if="showTopbar" class="shrink-0 z-20" />
    <router-view />
  </div>
</template>
