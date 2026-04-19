<template>
  <div class="flex-1 flex overflow-hidden min-h-0">
    <MapFilterSidebar @apply="onApplyFilters" />

    <main class="flex-1 relative bg-surface overflow-hidden flex flex-col h-full" aria-label="Semantic map">

      <!-- Search bar -->
      <div class="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
        <div class="bg-surface-container-high/80 backdrop-blur-md rounded-lg p-1.5 flex items-center ambient-shadow outline outline-1 outline-outline-variant/15">
          <span class="material-symbols-outlined text-primary ml-3 mr-2">search</span>
          <input
            v-model="searchQuery"
            class="flex-1 bg-transparent border-none text-on-surface placeholder-on-surface-variant focus:ring-0 text-sm py-2"
            placeholder="Search semantic space..."
            type="text"
            aria-label="Search semantic space"
          />
          <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-highest px-2 py-1 rounded mr-2">
            CMD K
          </span>
        </div>
      </div>

      <!-- 2D / 3D toggle -->
      <div class="absolute top-6 right-6 z-20 flex items-center gap-2">
        <div class="flex bg-surface-container-high/80 backdrop-blur-md rounded outline outline-1 outline-outline-variant/15 p-1">
          <button
            class="px-3 py-1 rounded text-xs font-bold transition-colors"
            :class="plotMode === '2d' ? 'bg-surface-variant text-on-surface' : 'text-on-surface-variant hover:text-on-surface'"
            @click="plotMode = '2d'"
          >
            2D
          </button>
          <button
            class="px-3 py-1 rounded text-xs font-bold transition-colors"
            :class="plotMode === '3d' ? 'bg-surface-variant text-on-surface' : 'text-on-surface-variant hover:text-on-surface'"
            @click="plotMode = '3d'"
          >
            3D
          </button>
        </div>
        <button class="w-8 h-8 flex items-center justify-center bg-surface-container-high/80 backdrop-blur-md rounded outline outline-1 outline-outline-variant/15 text-on-surface-variant hover:text-on-surface transition-colors" aria-label="Zoom in">
          <span class="material-symbols-outlined text-[18px]">add</span>
        </button>
        <button class="w-8 h-8 flex items-center justify-center bg-surface-container-high/80 backdrop-blur-md rounded outline outline-1 outline-outline-variant/15 text-on-surface-variant hover:text-on-surface transition-colors" aria-label="Zoom out">
          <span class="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <button class="w-8 h-8 flex items-center justify-center bg-surface-container-high/80 backdrop-blur-md rounded outline outline-1 outline-outline-variant/15 text-on-surface-variant hover:text-primary transition-colors" aria-label="Reset view">
          <span class="material-symbols-outlined text-[18px]">my_location</span>
        </button>
      </div>

      <!-- Scatter plot -->
      <div class="flex-1 relative w-full h-full">
        <ScatterPlot :mode="plotMode" @hover="onHover" />

        <!-- Hover tooltip -->
        <Transition name="fade">
          <div
            v-if="hoveredPoint"
            class="absolute top-1/3 left-1/2 z-30 bg-surface-container-highest/95 backdrop-blur-md p-4 rounded-lg ambient-shadow outline outline-1 outline-outline-variant/20 w-64 translate-x-12 -translate-y-12 pointer-events-none"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full inline-block" :class="hoveredPoint.project.includes('Flora') ? 'bg-secondary-container' : 'bg-primary'" />
                <span class="text-[10px] font-bold uppercase tracking-[0.05em]" :class="hoveredPoint.project.includes('Flora') ? 'text-secondary-container' : 'text-primary'">
                  {{ hoveredPoint.project }}
                </span>
              </div>
              <span class="text-[10px] text-on-surface-variant">{{ hoveredPoint.score }} Sim</span>
            </div>
            <h4 class="text-sm font-medium text-on-surface">{{ hoveredPoint.title }}</h4>
          </div>
        </Transition>
      </div>

      <ClusterTopology :clusters="clusters" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MapFilterSidebar from '../components/map/MapFilterSidebar.vue'
import ScatterPlot from '../components/map/ScatterPlot.vue'
import ClusterTopology from '../components/map/ClusterTopology.vue'

type PlotMode = '2d' | '3d'

interface HoveredPoint {
  title: string
  project: string
  score: number
}

const plotMode = ref<PlotMode>('3d')
const searchQuery = ref('')
const hoveredPoint = ref<HoveredPoint | null>(null)

const clusters = ref([
  { name: 'Core UI Architecture', points: 428, project: 'signalcanvas' as const },
  { name: 'Data Pipeline Refactor', points: 156, project: 'flora' as const },
])

function onHover(data: HoveredPoint | null) {
  hoveredPoint.value = data
}

function onApplyFilters(filters: { selectedProjects: string[]; dateFrom: string; dateTo: string }) {
  void filters
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
