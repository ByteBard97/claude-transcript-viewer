<template>
  <article
    class="bg-surface-container-high rounded-lg p-5 ghost-border hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] transition-shadow duration-300 cursor-pointer"
    data-testid="result-card"
    @click="openTranscript"
  >
    <div class="flex justify-between items-start mb-4">
      <div>
        <h3 class="text-base font-semibold text-on-surface mb-1">{{ result.title }}</h3>
        <div class="flex items-center gap-2 text-xs">
          <span class="px-2 py-0.5 rounded-sm font-bold tracking-wider" :class="projectBadgeClass">
            {{ projectLabel }}
          </span>
          <template v-if="result.role">
            <span class="text-on-surface-variant">•</span>
            <span class="font-bold tracking-wider" :class="roleLabelClass">
              {{ result.role.toUpperCase() }}
            </span>
          </template>
        </div>
      </div>
      <span class="text-xs text-on-surface-variant font-mono whitespace-nowrap ml-4">
        {{ formattedDate }}
      </span>
    </div>

    <div v-if="result.snippet" class="bg-surface-container-lowest rounded-md p-4 mt-3">
      <div class="text-xs font-bold uppercase tracking-wider text-outline mb-2">
        {{ snippetFilename }}
      </div>
      <pre class="text-sm font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap line-clamp-4"><code>{{ cleanSnippet }}</code></pre>
    </div>

    <p v-else class="text-sm text-on-surface-variant leading-relaxed mt-2 line-clamp-2">
      {{ result.title }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResult } from '../../api/search'

const props = defineProps<{ result: SearchResult }>()

const isSignalCanvas = computed(() =>
  props.result.project?.toLowerCase().includes('signalcanvas')
)

const projectLabel = computed(() =>
  isSignalCanvas.value ? 'SIGNALCANVAS' : 'FLORA UXP'
)

const projectBadgeClass = computed(() =>
  isSignalCanvas.value ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
)

const roleLabelClass = computed(() =>
  props.result.role === 'assistant' ? 'text-secondary' : 'text-on-surface'
)

const formattedDate = computed(() => {
  const raw = props.result.created_at
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).toUpperCase()
})

const cleanSnippet = computed(() => {
  const s = props.result.snippet ?? ''
  return s.replace(/<[^>]+>/g, '').trim()
})

const snippetFilename = computed(() => {
  const match = props.result.snippet?.match(/```(\w[\w.]+)/)
  return match ? match[1].toUpperCase() : 'SNIPPET'
})

function openTranscript() {
  if (props.result.url) window.open(`http://localhost:3000${props.result.url}`, '_blank')
}
</script>
