<template>
  <aside
    class="w-72 bg-surface-container-low h-full flex flex-col shrink-0 border-r border-outline-variant/10 z-30"
    aria-label="Map filters"
  >
    <div class="p-6 flex-1">
      <h2 class="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant mb-6">
        Topology Filters
      </h2>

      <!-- Projects -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-on-surface">Projects</h3>
          <button
            class="text-primary text-[10px] uppercase font-bold tracking-wider hover:text-primary-fixed-dim"
            @click="clearProjects"
          >
            Clear
          </button>
        </div>
        <div class="space-y-2">
          <label
            v-for="project in projects"
            :key="project.id"
            class="flex items-center gap-3 cursor-pointer group"
          >
            <input
              v-model="selectedProjects"
              :value="project.id"
              class="w-4 h-4 rounded border-outline-variant bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:ring-offset-0"
              :class="project.checkboxColor"
              type="checkbox"
            />
            <span class="text-sm text-on-surface group-hover:text-primary-fixed transition-colors flex items-center gap-2">
              <span class="w-2 h-2 rounded-full inline-block" :class="project.dotColor" />
              {{ project.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Time Horizon -->
      <div class="mb-8">
        <h3 class="text-sm font-medium text-on-surface mb-3">Time Horizon</h3>
        <div class="flex flex-col gap-2">
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              calendar_today
            </span>
            <input
              v-model="dateFrom"
              class="w-full bg-surface-container-lowest border-none rounded text-sm text-on-surface pl-9 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              type="date"
              aria-label="From date"
            />
          </div>
          <div class="text-center text-on-surface-variant text-[10px]">to</div>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              calendar_today
            </span>
            <input
              v-model="dateTo"
              class="w-full bg-surface-container-lowest border-none rounded text-sm text-on-surface pl-9 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              type="date"
              aria-label="To date"
              placeholder="Present"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-outline-variant/10">
      <button
        class="w-full btn-gradient text-on-primary-container py-2 rounded font-medium text-sm hover:brightness-105 active:brightness-95 transition-all duration-150"
        @click="emit('apply', { selectedProjects, dateFrom, dateTo })"
      >
        Apply Layout
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface ProjectOption {
  id: string
  label: string
  dotColor: string
  checkboxColor: string
}

const PROJECTS: ProjectOption[] = [
  { id: 'signalcanvas', label: 'SignalCanvas', dotColor: 'bg-primary', checkboxColor: 'text-primary' },
  { id: 'flora', label: 'Flora UXP', dotColor: 'bg-secondary-container', checkboxColor: 'text-secondary-container' },
]

const emit = defineEmits<{
  apply: [filters: { selectedProjects: string[]; dateFrom: string; dateTo: string }]
}>()

const projects = PROJECTS
const selectedProjects = ref(['signalcanvas', 'flora'])
const dateFrom = ref('')
const dateTo = ref('')

function clearProjects() {
  selectedProjects.value = []
}
</script>
