<template>
  <nav
    class="bg-[#0b1326] h-screen w-16 fixed left-0 top-0 z-40 flex flex-col items-center pt-20 pb-8 gap-y-8 shadow-[2px_0_10px_rgba(0,0,0,0.5)]"
    aria-label="Main navigation"
  >
    <div class="flex flex-col items-center gap-1 mb-2">
      <span class="text-cyan-400 font-black tracking-widest text-[10px]">SS</span>
      <span class="text-cyan-400 font-black tracking-widest text-[10px]">V2</span>
    </div>

    <RouterLink
      v-for="item in navItems"
      :key="item.route"
      :to="item.route"
      :title="item.label"
      class="p-3 rounded-sm flex items-center justify-center transition-colors duration-150 relative group"
      :class="isActive(item.route)
        ? 'text-cyan-400 bg-cyan-400/10 scale-95'
        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'"
      :aria-label="item.label"
    >
      <span
        class="material-symbols-outlined"
        :class="{ 'filled-icon': isActive(item.route) }"
      >{{ item.icon }}</span>
      <span
        class="hidden group-hover:block absolute left-14 bg-surface-container-highest text-on-surface text-[10px] px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap"
      >{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

interface NavItem {
  route: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { route: '/search', label: 'History', icon: 'history' },
  { route: '/projects', label: 'Projects', icon: 'folder_open' },
  { route: '/map', label: 'Semantic Map', icon: 'hub' },
]

const route = useRoute()
const navItems = NAV_ITEMS

function isActive(routePath: string): boolean {
  return route.path === routePath
}
</script>
