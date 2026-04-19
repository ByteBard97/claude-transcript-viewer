<template>
  <div class="flex-1 flex overflow-hidden min-h-0">
    <FilterSidebar @change="onFilterChange" />

    <main class="flex-1 bg-surface flex flex-col relative min-h-0" aria-label="Search results">
      <div class="absolute left-10 top-0 bottom-0 w-[2px] bg-outline-variant opacity-10 z-0 pointer-events-none" />

      <div class="flex-1 overflow-y-auto p-8 relative z-10">
        <div class="mb-8 flex justify-between items-end">
          <div>
            <h2 class="text-2xl font-light tracking-tight text-on-surface mb-1">Search Results</h2>
            <p class="text-sm text-on-surface-variant">{{ resultsSubtitle }}</p>
          </div>
          <div v-if="!loading && results.length > 0" class="text-right" data-testid="result-count">
            <span class="text-xs font-bold uppercase tracking-[0.05em] text-primary">
              {{ totalResults }} Results
            </span>
            <span class="text-xs text-on-surface-variant ml-2">in {{ queryTimeMs }}ms</span>
          </div>
        </div>

        <div v-if="loading" class="flex justify-center py-16" data-testid="loading-state">
          <span class="text-on-surface-variant text-sm">Searching...</span>
        </div>

        <div v-else-if="error" class="py-16 text-center" data-testid="error-state">
          <span class="text-error text-sm">{{ error }}</span>
        </div>

        <div v-else-if="results.length === 0" class="py-16 text-center" data-testid="empty-state">
          <span class="text-on-surface-variant text-sm">No results found.</span>
        </div>

        <div v-else class="space-y-6" data-testid="results-list">
          <ResultCard v-for="(result, i) in results" :key="result.id ?? result.conversation_id ?? i" :result="result" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FilterSidebar from '../components/search/FilterSidebar.vue'
import ResultCard from '../components/search/ResultCard.vue'
import { searchConversations } from '../api/search'
import type { SearchResult } from '../api/search'

const DEBOUNCE_MS = 300

const results = ref<SearchResult[]>([])
const totalResults = ref(0)
const queryTimeMs = ref(0)
const loading = ref(false)
const error = ref('')

let debounceTimer: ReturnType<typeof setTimeout>

interface FilterState {
  q: string
  selectedProjects: string[]
  role: string
  after: string
  before: string
}

const currentFilters = ref<FilterState>({
  q: '',
  selectedProjects: [],
  role: '',
  after: '',
  before: '',
})

const resultsSubtitle = computed(() => {
  if (loading.value) return 'Searching...'
  if (currentFilters.value.q) return `Results for "${currentFilters.value.q}"`
  return 'Showing recent conversations.'
})

async function runSearch() {
  loading.value = true
  error.value = ''
  try {
    const f = currentFilters.value
    const response = await searchConversations({
      q: f.q,
      role: (f.role as 'user' | 'assistant') || undefined,
      after: f.after || undefined,
      before: f.before || undefined,
      limit: 20,
    })
    const raw = response.results ?? response.conversations ?? []
    results.value = raw as SearchResult[]
    totalResults.value = response.total ?? raw.length
    queryTimeMs.value = Math.round(response.query_time_ms ?? 0)
  } catch {
    error.value = 'Could not connect to Session Search backend.'
    results.value = []
  } finally {
    loading.value = false
  }
}

function onFilterChange(filters: FilterState) {
  currentFilters.value = filters
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, DEBOUNCE_MS)
}

// Single initial load
watch(currentFilters, runSearch, { deep: true, immediate: true })
</script>
