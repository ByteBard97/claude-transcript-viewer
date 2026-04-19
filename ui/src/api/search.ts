import axios from 'axios'

const BASE_URL = ''

export interface SearchResult {
  // present on both recent and search results
  id?: string
  conversation_id?: string
  chunk_id?: number
  project: string
  title: string
  created_at?: string
  // present on search results only
  snippet?: string
  role?: 'user' | 'assistant'
  page?: number
  score?: number
  url?: string
}

export interface SearchResponse {
  type: 'hybrid' | 'fts_only' | 'recent'
  results?: SearchResult[]
  conversations?: SearchResult[]
  total: number
  query_time_ms: number
  embedding_status: string
}

export interface IndexStatus {
  status: string
  conversations: number
  chunks: number
  embedding_server: string
}

export interface SearchFilters {
  q: string
  project?: string
  role?: 'user' | 'assistant'
  after?: string
  before?: string
  limit?: number
  offset?: number
}

export async function searchConversations(filters: SearchFilters): Promise<SearchResponse> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  )
  const { data } = await axios.get<SearchResponse>(`${BASE_URL}/api/search`, { params })
  return data
}

export async function fetchProjects(): Promise<string[]> {
  const { data } = await axios.get<{ projects: string[] }>(`${BASE_URL}/api/projects`)
  return data.projects
}

export async function fetchIndexStatus(): Promise<IndexStatus> {
  const { data } = await axios.get<IndexStatus>(`${BASE_URL}/api/index/status`)
  return data
}
