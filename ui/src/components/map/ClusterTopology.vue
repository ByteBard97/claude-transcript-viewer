<template>
  <div
    class="absolute bottom-6 right-6 z-20 w-72 bg-surface-container-high/90 backdrop-blur-md rounded-lg p-4 ambient-shadow outline outline-1 outline-outline-variant/15"
    aria-label="Cluster topology"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">
        Cluster Topology
      </h3>
      <button class="text-on-surface-variant hover:text-on-surface transition-colors" aria-label="More options">
        <span class="material-symbols-outlined text-[16px]">more_horiz</span>
      </button>
    </div>

    <div class="space-y-4">
      <div v-for="cluster in clusters" :key="cluster.name">
        <div class="flex justify-between items-end mb-1">
          <span class="text-xs font-medium text-on-surface flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full inline-block" :class="cluster.dotColor" />
            {{ cluster.name }}
          </span>
          <span class="text-[10px]" :class="cluster.countColor">
            {{ cluster.points.toLocaleString() }} pts
          </span>
        </div>
        <div class="h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            class="h-full rounded-full"
            :class="cluster.barColor"
            :style="{ width: cluster.barWidth }"
          />
        </div>
      </div>
    </div>

    <div class="mt-4 pt-3 border-t border-outline-variant/10 flex justify-between items-center text-[10px] text-on-surface-variant">
      <span>Total Nodes: {{ totalNodes.toLocaleString() }}</span>
      <button class="flex items-center gap-1 hover:text-primary transition-colors">
        Expand Stats
        <span class="material-symbols-outlined text-[12px]">open_in_new</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ClusterData {
  name: string
  points: number
  project: 'signalcanvas' | 'flora'
}

const props = defineProps<{ clusters: ClusterData[] }>()

const MAX_POINTS = 2000

const clusters = computed(() =>
  props.clusters.map((c) => ({
    ...c,
    dotColor: c.project === 'signalcanvas' ? 'bg-primary' : 'bg-secondary-container',
    countColor: c.project === 'signalcanvas' ? 'text-primary' : 'text-secondary-container',
    barColor: c.project === 'signalcanvas' ? 'bg-primary' : 'bg-secondary-container',
    barWidth: `${Math.round((c.points / MAX_POINTS) * 100)}%`,
  }))
)

const totalNodes = computed(() => props.clusters.reduce((sum, c) => sum + c.points, 0))
</script>
