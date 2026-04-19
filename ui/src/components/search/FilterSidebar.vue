<template>
  <aside
    class="w-80 bg-surface-container-low flex flex-col border-r border-surface-container-high/20 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
    aria-label="Search filters"
    data-testid="filter-sidebar"
  >
    <div class="p-6 flex-1 overflow-y-auto">
      <h2 class="text-sm font-bold uppercase tracking-[0.05em] text-on-surface mb-6">Filters</h2>

      <!-- Keyword search -->
      <div class="mb-8">
        <label class="block text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant mb-2">
          Keyword
        </label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
          <input
            v-model="localFilters.q"
            class="w-full bg-surface-container-lowest text-on-surface rounded border-none pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary placeholder-outline-variant transition-shadow"
            placeholder="Search transcripts..."
            type="text"
            aria-label="Search transcripts"
            data-testid="search-input"
          />
        </div>
      </div>

      <!-- Projects -->
      <div class="mb-8">
        <label class="block text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant mb-3">
          Projects
        </label>
        <div class="space-y-3">
          <label
            v-for="project in projects"
            :key="project.id"
            class="flex items-center gap-3 cursor-pointer group"
          >
            <input
              v-model="localFilters.selectedProjects"
              :value="project.id"
              class="form-checkbox bg-surface-container-lowest border-outline-variant rounded-sm focus:ring-primary focus:ring-offset-0"
              :class="project.checkboxColor"
              type="checkbox"
            />
            <span class="text-sm text-on-surface group-hover:text-primary transition-colors flex items-center gap-2">
              <span class="w-2 h-2 rounded-full inline-block" :class="project.dotColor" />
              {{ project.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Role -->
      <div class="mb-8">
        <label class="block text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant mb-3">
          Role
        </label>
        <div class="flex bg-surface-container-lowest rounded p-1" role="group" aria-label="Role filter" data-testid="role-toggle">
          <button
            v-for="option in roleOptions"
            :key="option.value"
            class="flex-1 py-1.5 px-3 rounded-sm text-xs font-semibold transition-colors"
            :class="localFilters.role === option.value
              ? 'bg-surface-variant text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'"
            @click="localFilters.role = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Timeframe -->
      <div class="mb-8">
        <label class="block text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant mb-3">
          Timeframe
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model="localFilters.after"
            class="w-full bg-surface-container-lowest text-on-surface rounded border-none px-3 py-2 text-xs focus:ring-1 focus:ring-primary text-on-surface-variant"
            type="date"
            aria-label="From date"
          />
          <span class="text-on-surface-variant">–</span>
          <input
            v-model="localFilters.before"
            class="w-full bg-surface-container-lowest text-on-surface rounded border-none px-3 py-2 text-xs focus:ring-1 focus:ring-primary text-on-surface-variant"
            type="date"
            aria-label="To date"
          />
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

interface ProjectOption {
  id: string
  label: string
  dotColor: string
  checkboxColor: string
}

interface FilterState {
  q: string
  selectedProjects: string[]
  role: string
  after: string
  before: string
}

const PROJECTS: ProjectOption[] = [
  { id: 'SignalCanvas', label: 'SignalCanvas', dotColor: 'bg-primary', checkboxColor: 'text-primary' },
  { id: 'Flora UXP', label: 'Flora UXP', dotColor: 'bg-secondary', checkboxColor: 'text-secondary' },
]

const ROLE_OPTIONS = [
  { value: '', label: 'Both' },
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Asst' },
]

const emit = defineEmits<{
  change: [filters: FilterState]
}>()

const projects = PROJECTS
const roleOptions = ROLE_OPTIONS

const localFilters = reactive<FilterState>({
  q: '',
  selectedProjects: ['SignalCanvas', 'Flora UXP'],
  role: '',
  after: '',
  before: '',
})

watch(localFilters, (val) => emit('change', { ...val }), { deep: true })
</script>
