<template>
  <header
    class="bg-[#0b1326] backdrop-blur-md sticky top-0 z-50 flex justify-between items-center px-6 py-3 w-full border-b border-surface-container-high/30 shadow-md"
    aria-label="Application header"
  >
    <h1 class="text-lg font-light tracking-tighter text-slate-100">Session Search</h1>

    <div class="flex items-center gap-6">
      <span class="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.05em]">
        {{ statusText }}
      </span>
      <div class="flex items-center gap-3">
        <button
          class="text-slate-400 hover:bg-slate-800/50 hover:text-cyan-300 transition-all duration-150 p-2 rounded-full"
          aria-label="Settings"
        >
          <span class="material-symbols-outlined">settings</span>
        </button>
        <button
          class="text-slate-400 hover:bg-slate-800/50 hover:text-cyan-300 transition-all duration-150 p-2 rounded-full"
          aria-label="Account"
        >
          <span class="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchIndexStatus } from '../api/search'

const FALLBACK_STATUS = '1,782,525 chunks indexed • Embeddings: active'

const statusText = ref(FALLBACK_STATUS)

onMounted(async () => {
  try {
    const status = await fetchIndexStatus()
    statusText.value = `${status.chunks.toLocaleString()} chunks indexed • Embeddings: ${status.embedding_server}`
  } catch {
    statusText.value = FALLBACK_STATUS
  }
})
</script>
