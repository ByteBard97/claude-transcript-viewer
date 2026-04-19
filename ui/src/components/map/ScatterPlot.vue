<template>
  <div ref="plotContainer" class="w-full h-full" aria-label="Semantic map scatter plot" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Plotly from 'plotly.js-dist-min'
import type { PlotlyHTMLElement } from 'plotly.js'
import { generateMockUmapData } from '../../utils/mockUmapData'

const PLOTLY_CONFIG = { responsive: true, displayModeBar: false }

const SURFACE_COLOR = '#0b1326'
const GRID_COLOR = '#222a3d'
const SIGNALCANVAS_COLOR = '#a4e6ff'
const FLORA_COLOR = '#feb700'
const POINT_SIZE = 5
const POINT_OPACITY = 0.8

type PlotMode = '2d' | '3d'

const props = defineProps<{ mode: PlotMode }>()
const emit = defineEmits<{ hover: [data: { title: string; project: string; score: number } | null] }>()

const plotContainer = ref<HTMLElement | null>(null)
let plotEl: PlotlyHTMLElement | null = null

const { signalCanvasPoints, floraPoints } = generateMockUmapData()

function buildTraces(mode: PlotMode): Plotly.Data[] {
  const axisKeys = mode === '3d'
    ? { x: 'x', y: 'y', z: 'z', type: 'scatter3d' as const }
    : { x: 'x', y: 'y', type: 'scattergl' as const }

  return [
    {
      ...axisKeys,
      x: signalCanvasPoints.map((p) => p.x),
      y: signalCanvasPoints.map((p) => p.y),
      ...(mode === '3d' ? { z: signalCanvasPoints.map((p) => p.z) } : {}),
      mode: 'markers',
      name: 'SignalCanvas',
      text: signalCanvasPoints.map((p) => p.title),
      marker: { color: SIGNALCANVAS_COLOR, size: POINT_SIZE, opacity: POINT_OPACITY },
    },
    {
      ...axisKeys,
      x: floraPoints.map((p) => p.x),
      y: floraPoints.map((p) => p.y),
      ...(mode === '3d' ? { z: floraPoints.map((p) => p.z) } : {}),
      mode: 'markers',
      name: 'Flora UXP',
      text: floraPoints.map((p) => p.title),
      marker: { color: FLORA_COLOR, size: POINT_SIZE, opacity: POINT_OPACITY },
    },
  ]
}

function buildLayout(mode: PlotMode): Partial<Plotly.Layout> {
  const base = {
    paper_bgcolor: SURFACE_COLOR,
    plot_bgcolor: SURFACE_COLOR,
    legend: { font: { color: '#dae2fd', size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    hovermode: 'closest' as const,
  }

  if (mode === '3d') {
    return {
      ...base,
      scene: {
        bgcolor: SURFACE_COLOR,
        xaxis: { showgrid: true, gridcolor: GRID_COLOR, zeroline: false, showticklabels: false },
        yaxis: { showgrid: true, gridcolor: GRID_COLOR, zeroline: false, showticklabels: false },
        zaxis: { showgrid: true, gridcolor: GRID_COLOR, zeroline: false, showticklabels: false },
      },
    }
  }

  return {
    ...base,
    xaxis: { showgrid: false, zeroline: false, showticklabels: false },
    yaxis: { showgrid: false, zeroline: false, showticklabels: false },
  }
}

async function renderPlot() {
  if (!plotContainer.value) return
  const traces = buildTraces(props.mode)
  const layout = buildLayout(props.mode)
  plotEl = await Plotly.newPlot(plotContainer.value, traces, layout, PLOTLY_CONFIG) as PlotlyHTMLElement

  plotEl.on('plotly_hover', (data: Plotly.PlotHoverEvent) => {
    const pt = data.points[0]
    emit('hover', { title: String(pt.text ?? ''), project: pt.data.name as string, score: 0.92 })
  })
  plotEl.on('plotly_unhover', () => emit('hover', null))
}

onMounted(renderPlot)

watch(() => props.mode, async () => {
  if (plotEl) Plotly.purge(plotEl)
  await renderPlot()
})

onUnmounted(() => {
  if (plotEl) Plotly.purge(plotEl)
})
</script>
