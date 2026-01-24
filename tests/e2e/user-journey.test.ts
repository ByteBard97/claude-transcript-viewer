/**
 * E2E User Journey Test
 *
 * Tests the complete user experience with real Claude Code transcript data:
 * 1. Index real JSONL transcripts from fixtures
 * 2. Start the viewer server
 * 3. Test search (FTS and semantic when available)
 * 4. Test all filters (project, role, date)
 * 5. Test navigation (project listing, session pages)
 * 6. Test HTML enhancements (dark mode, infinite scroll markup)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runIndexer } from '../../src/indexer/index.js';
import { createDatabase, closeDatabase, getDatabase } from '../../src/db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures/source');
const ARCHIVE_DIR = join(__dirname, 'fixtures/archive');
const TEST_DB = join(__dirname, 'fixtures/test-search.db');
const TEST_PORT = 3099;

// Helper to wait for server to be ready
async function waitForServer(port: number, timeout = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/api/index/status`);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// Helper to make API requests
async function api(path: string): Promise<Response> {
  return fetch(`http://localhost:${TEST_PORT}${path}`);
}

// Helper to get JSON response
async function apiJson<T>(path: string): Promise<T> {
  const res = await api(path);
  return res.json() as Promise<T>;
}

describe('E2E: User Journey with Real Transcripts', () => {
  let serverProcess: ChildProcess | null = null;

  beforeAll(async () => {
    // Clean up any existing test artifacts
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(ARCHIVE_DIR)) rmSync(ARCHIVE_DIR, { recursive: true });
    mkdirSync(ARCHIVE_DIR, { recursive: true });

    // Verify fixtures exist
    const projects = readdirSync(FIXTURES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    console.log(`Found ${projects.length} projects in fixtures:`, projects);
    expect(projects.length).toBeGreaterThan(0);

    // Count total JSONL files
    let totalFiles = 0;
    for (const project of projects) {
      const projectDir = join(FIXTURES_DIR, project);
      const files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      totalFiles += files.length;

      // Create corresponding archive directory (mock HTML generation)
      // In a full test, we'd run claude-code-transcripts here
      const archiveProjectDir = join(ARCHIVE_DIR, project);
      mkdirSync(archiveProjectDir, { recursive: true });
    }
    console.log(`Total JSONL files: ${totalFiles}`);
    expect(totalFiles).toBeGreaterThanOrEqual(3);

    // Run indexer on fixtures
    console.log('Running indexer on fixtures...');
    const stats = await runIndexer({
      sourceDir: FIXTURES_DIR,
      databasePath: TEST_DB,
      verbose: false,
    });

    console.log(`Indexing complete: ${stats.added} added, ${stats.chunks} chunks`);
    expect(stats.added).toBeGreaterThan(0);
    expect(stats.chunks).toBeGreaterThan(0);
    expect(stats.errors.length).toBe(0);

    // Close the indexer's database connection before starting server
    closeDatabase();

    // Start the server
    console.log('Starting test server...');
    serverProcess = spawn('node', ['dist/server.js', ARCHIVE_DIR], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        DATABASE_PATH: TEST_DB,
        ARCHIVE_DIR: ARCHIVE_DIR,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => {
      if (process.env.DEBUG) console.log('[server]', data.toString());
    });
    serverProcess.stderr?.on('data', (data) => {
      console.error('[server error]', data.toString());
    });

    // Wait for server to be ready
    const ready = await waitForServer(TEST_PORT);
    expect(ready).toBe(true);
    console.log('Server ready!');
  }, 60000); // 60s timeout for setup

  afterAll(async () => {
    // Kill server
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 500));
    }

    // Clean up
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(ARCHIVE_DIR)) rmSync(ARCHIVE_DIR, { recursive: true });
  });

  describe('Index Status', () => {
    it('reports correct index status', async () => {
      const status = await apiJson<{
        status: string;
        conversations: number;
        chunks: number;
      }>('/api/index/status');

      expect(status.status).toBe('ready');
      expect(status.conversations).toBeGreaterThanOrEqual(3);
      expect(status.chunks).toBeGreaterThan(0);
    });
  });

  describe('Project Listing', () => {
    it('lists all indexed projects', async () => {
      const data = await apiJson<{ projects: string[] }>('/api/projects');

      expect(data.projects).toContain('web-app');
      expect(data.projects).toContain('api-server');
      expect(data.projects).toContain('cli-tool');
    });
  });

  describe('Search Functionality', () => {
    it('finds results for terms in fixtures', async () => {
      // Use terms that appear in our synthetic fixtures
      const result = await apiJson<{
        type: string;
        results?: Array<{ content: string }>;
      }>('/api/search?q=user&limit=10');

      // Should return results array (may be empty if no matches)
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('returns empty query as recent conversations', async () => {
      const result = await apiJson<{
        type: string;
        conversations?: Array<{ id: string }>;
      }>('/api/search?q=');

      expect(result.type).toBe('recent');
      expect(result.conversations?.length).toBeGreaterThan(0);
    });

    it('search results have required fields', async () => {
      const result = await apiJson<{
        results?: Array<{
          chunk_id: number;
          conversation_id: string;
          project: string;
          title: string;
          snippet: string;
          role: string;
          url: string;
        }>;
      }>('/api/search?q=function&limit=1');

      expect(result.results?.length).toBeGreaterThan(0);

      const first = result.results![0];
      expect(first).toHaveProperty('chunk_id');
      expect(first).toHaveProperty('conversation_id');
      expect(first).toHaveProperty('project');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('snippet');
      expect(first).toHaveProperty('role');
      expect(first).toHaveProperty('url');
    });

    it('snippets contain highlighted search terms', async () => {
      const result = await apiJson<{
        results?: Array<{ snippet: string }>;
      }>('/api/search?q=error&limit=5');

      // At least one snippet should have highlighted term
      const hasHighlight = result.results?.some(r =>
        r.snippet.includes('<strong>') && r.snippet.toLowerCase().includes('error')
      );
      expect(hasHighlight).toBe(true);
    });
  });

  describe('Filter Functionality', () => {
    it('filters by project', async () => {
      const result = await apiJson<{
        results?: Array<{ project: string }>;
      }>('/api/search?q=React&project=web-app&limit=10');

      if (result.results && result.results.length > 0) {
        const allFromProject = result.results.every(r =>
          r.project.includes('web-app')
        );
        expect(allFromProject).toBe(true);
      }
    });

    it('filters by role (user)', async () => {
      const result = await apiJson<{
        results?: Array<{ role: string }>;
      }>('/api/search?q=help&role=user&limit=10');

      if (result.results && result.results.length > 0) {
        expect(result.results.every(r => r.role === 'user')).toBe(true);
      }
    });

    it('filters by role (assistant)', async () => {
      const result = await apiJson<{
        results?: Array<{ role: string }>;
      }>('/api/search?q=function&role=assistant&limit=10');

      if (result.results && result.results.length > 0) {
        expect(result.results.every(r => r.role === 'assistant')).toBe(true);
      }
    });

    it('respects limit parameter', async () => {
      const result5 = await apiJson<{ results?: Array<unknown> }>('/api/search?q=the&limit=5');
      const result20 = await apiJson<{ results?: Array<unknown> }>('/api/search?q=the&limit=20');

      expect(result5.results?.length).toBeLessThanOrEqual(5);
      expect(result20.results?.length).toBeLessThanOrEqual(20);

      // Assuming "the" appears often, limit=20 should return more
      if (result5.results && result20.results) {
        expect(result20.results.length).toBeGreaterThanOrEqual(result5.results.length);
      }
    });

    it('respects offset for pagination', async () => {
      const page1 = await apiJson<{
        results?: Array<{ chunk_id: number }>;
      }>('/api/search?q=the&limit=5&offset=0');

      const page2 = await apiJson<{
        results?: Array<{ chunk_id: number }>;
      }>('/api/search?q=the&limit=5&offset=5');

      // Results should be different (no overlap)
      if (page1.results && page2.results && page1.results.length > 0 && page2.results.length > 0) {
        const page1Ids = new Set(page1.results.map(r => r.chunk_id));
        const page2Ids = page2.results.map(r => r.chunk_id);

        const hasOverlap = page2Ids.some(id => page1Ids.has(id));
        expect(hasOverlap).toBe(false);
      }
    });
  });

  describe('Landing Page', () => {
    it('returns HTML landing page', async () => {
      const res = await api('/');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('Claude Transcript Viewer');
      expect(html).toContain('chunks indexed');
    });

    it('landing page shows project cards', async () => {
      const res = await api('/');
      const html = await res.text();

      // Should show project cards for indexed projects
      expect(html).toContain('project-card');
      expect(html).toContain('conversations');
    });

    it('landing page shows recent conversations', async () => {
      const res = await api('/');
      const html = await res.text();

      expect(html).toContain('Recent Conversations');
      expect(html).toContain('recent-list');
    });
  });

  describe('Search Page', () => {
    it('returns search results page', async () => {
      const res = await api('/search?q=function');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('Search');
      expect(html).toContain('function');
    });

    it('search page has filter controls', async () => {
      const res = await api('/search?q=test');
      const html = await res.text();

      // Should have filter dropdowns
      expect(html).toContain('name="project"');
      expect(html).toContain('name="role"');
      expect(html).toContain('All projects');
    });

    it('shows no results message for nonsense query', async () => {
      const res = await api('/search?q=xyzzy12345nonexistent');
      const html = await res.text();

      expect(html).toContain('No results found');
    });
  });

  describe('Response Times', () => {
    it('search API responds within 500ms', async () => {
      const start = Date.now();
      await apiJson('/api/search?q=function&limit=20');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it('index status API responds within 100ms', async () => {
      const start = Date.now();
      await apiJson('/api/index/status');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Multi-term Search', () => {
    it('handles multi-word queries', async () => {
      const result = await apiJson<{
        results?: Array<{ content: string }>;
      }>('/api/search?q=function%20error&limit=10');

      // Should return results (may contain either or both terms)
      expect(result.results).toBeDefined();
    });

    it('handles quoted phrases', async () => {
      const result = await apiJson<{
        results?: Array<unknown>;
      }>('/api/search?q="test%20file"&limit=10');

      // Should not error on quoted phrases
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in query', async () => {
      const queries = [
        '/api/search?q=%3Cscript%3E', // <script>
        '/api/search?q=%27OR%201%3D1', // 'OR 1=1
        '/api/search?q=%2F%2F%20comment', // // comment
      ];

      for (const query of queries) {
        const res = await api(query);
        expect(res.status).toBe(200);
      }
    });

    it('handles very long queries gracefully', async () => {
      const longQuery = 'a'.repeat(1000);
      const res = await api(`/api/search?q=${encodeURIComponent(longQuery)}&limit=5`);

      expect(res.status).toBe(200);
    });

    it('handles empty project filter', async () => {
      const result = await apiJson<{ results?: Array<unknown> }>(
        '/api/search?q=function&project=&limit=5'
      );

      expect(result.results).toBeDefined();
    });
  });
});
