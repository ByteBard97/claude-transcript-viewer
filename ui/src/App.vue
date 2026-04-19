<template>
  <div class="h-screen overflow-hidden flex bg-surface text-on-surface font-body">
    <NavRail />
    <div class="ml-16 flex-1 flex flex-col h-screen overflow-hidden">
      <TopBar />
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import NavRail from './components/NavRail.vue'
import TopBar from './components/TopBar.vue'
</script>
