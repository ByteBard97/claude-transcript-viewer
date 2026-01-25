# Claude Transcript Viewer

A web server for browsing and searching Claude Code conversation transcripts with semantic search, infinite scroll, and collapsible cells.

## Features

- **Semantic Search** - Hybrid FTS + vector search with highlighted snippets
- **MLX Embeddings** - Auto-starts Qwen3 embedding server on Apple Silicon
- **Auto Archive Generation** - Generates HTML from JSONL transcripts on startup
- **Background Indexing** - Non-blocking indexing of conversations for search
- **Enhanced Viewing** - Collapsible cells, preview text, infinite scroll
- **Search Everywhere** - Search bar on every page with live dropdown results
- **Full Search Page** - Dedicated search results page with filters (project, role, date)

## Quick Start

```bash
# Run with npx (no installation required)
npx claude-transcript-viewer ~/claude-archive

# Or with live indexing from Claude Code transcripts
npx claude-transcript-viewer ~/claude-archive ~/.claude/projects
```

Open http://localhost:3000 to browse transcripts. The browser opens automatically.

## Understanding the Directories

The viewer uses two directories that serve different purposes:

### Archive Directory (required)

The **archive directory** contains pre-rendered HTML files for browsing. This is where the viewer serves content from and stores its search database.

```
~/claude-archive/                 # Your archive directory
├── cohouser/                     # Project folders
│   ├── abc123.html              # Rendered conversation
│   └── def456.html
├── tools/
│   └── ghi789.html
└── .search.db                    # SQLite search index (auto-created)
```

### Source Directory (optional)

The **source directory** points to raw Claude Code JSONL transcripts. When provided, the viewer can:
- Watch for new/modified transcripts
- Auto-generate HTML archives
- Keep the search index updated

```
~/.claude/projects/               # Claude Code's default location
├── -Users-me-projects-cohouser/
│   ├── abc123.jsonl             # Raw transcript files
│   └── def456.jsonl
└── -Users-me-projects-tools/
    └── ghi789.jsonl
```

### Usage Modes

**Read-only mode** - Browse an existing HTML archive:
```bash
npx claude-transcript-viewer ~/claude-archive
```

**Live mode** - Auto-generate archive from transcripts and keep it updated:
```bash
npx claude-transcript-viewer ~/claude-archive ~/.claude/projects
```

## Installation

### Via npx (recommended)

No installation required:

```bash
npx claude-transcript-viewer ~/claude-archive
```

### Via npm global install

```bash
npm install -g claude-transcript-viewer
claude-transcript-viewer ~/claude-archive
```

### From source

```bash
git clone https://github.com/varunr89/claude-transcript-viewer.git
cd claude-transcript-viewer
npm install
npm run dev -- ~/claude-archive
```

### Requirements

- Node.js 20+
- Python 3.9+ (for MLX embeddings on Apple Silicon)
- [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) Python CLI (for HTML generation)

```bash
# Install the Python CLI for HTML generation
pip install claude-code-transcripts
```

## CLI Options

```
Usage: claude-transcript-viewer [archive-dir] [source-dir] [options]

Arguments:
  archive-dir    Path to the HTML archive directory (default: ./claude-archive)
  source-dir     Path to Claude Code transcripts for live indexing (optional)

Options:
  --no-open      Don't auto-open browser on startup
  --help, -h     Show help message
  --version, -v  Show version number
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ARCHIVE_DIR` | `./claude-archive` | Directory for HTML files |
| `SOURCE_DIR` | (none) | JSONL source directory (enables auto-generation) |
| `DATABASE_PATH` | `ARCHIVE_DIR/.search.db` | SQLite database path |
| `EMBED_URL` | (none) | External embedding server URL |
| `EMBED_SOCKET` | `/tmp/qwen-embed.sock` | Unix socket for embedding server |
| `NO_OPEN` | `false` | Set to `true` to disable auto-open browser |
| `DEBUG` | `false` | Set to `true` for verbose logging |

## Embedding Server

The viewer supports semantic vector search via embeddings. On **Apple Silicon Macs**, an MLX-accelerated Qwen3 embedding server starts automatically. On other platforms, FTS (full-text search) is used as a fallback.

### Automatic (Apple Silicon)

No configuration needed. The server auto-starts with:
- Model: `mlx-community/Qwen3-Embedding-0.6B-4bit-DWQ`
- Dimensions: 1024
- First run downloads the model (~400MB)

### External Server

For non-Apple systems or custom embeddings:

```bash
# Point to an external embedding server
EMBED_URL=http://localhost:8000 npx claude-transcript-viewer ~/archive
```

## API Endpoints

### Search

```bash
# Search conversations
GET /api/search?q=sqlite&limit=20

# With filters
GET /api/search?q=typescript&project=my-project&role=assistant

# Parameters:
# - q: Search query
# - project: Filter by project name
# - role: Filter by role (user/assistant)
# - after: Filter by date (YYYY-MM-DD)
# - before: Filter by date (YYYY-MM-DD)
# - limit: Max results (default: 20)
# - offset: Pagination offset
```

### Status

```bash
# Get index and archive status
GET /api/index/status

# Response:
{
  "status": "ready",
  "conversations": 3471,
  "chunks": 596168,
  "embedding_server": "unavailable",
  "archive": {
    "isGenerating": false,
    "progress": "Complete",
    "lastRun": "2026-01-21T19:21:27Z"
  },
  "indexing": {
    "isIndexing": false,
    "progress": "Complete",
    "lastStats": { "added": 37, "modified": 0, "deleted": 0, "chunks": 16513 }
  }
}
```

### Manual Triggers

```bash
# Regenerate HTML archive and re-index
POST /api/archive/regenerate

# Re-index only (no HTML regeneration)
POST /api/index/reindex
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with projects and recent conversations |
| `/search?q=...` | Full search results page with filters |
| `/*.html` | Enhanced transcript pages with search bar |

## Architecture

```
JSONL files ─┬─> claude-code-transcripts (Python) ─> HTML files
             │
             └─> transcript-viewer indexer ─> SQLite (FTS + vectors)

HTML files ─> Express server ─> Enhanced HTML + Search API
```

### Search Pipeline

1. **FTS5** - Full-text search with trigram tokenizer for substring matching
2. **Vector Search** - Semantic similarity using sqlite-vec (when embedding server available)
3. **RRF Merge** - Reciprocal Rank Fusion combines both result sets
4. **Snippets** - Generates highlighted snippets around matched terms

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Start production server
npm start
```

### Project Structure

```
src/
├── server.ts           # Express server, routes, HTML enhancement
├── api/
│   ├── search.ts       # Hybrid search (FTS + vector + RRF)
│   └── snippets.ts     # Snippet generation and highlighting
├── db/
│   ├── index.ts        # Database initialization
│   ├── schema.ts       # Tables, indexes, triggers
│   ├── chunks.ts       # Chunk CRUD operations
│   └── conversations.ts # Conversation CRUD operations
├── indexer/
│   ├── index.ts        # Main indexing logic
│   ├── parser.ts       # JSONL transcript parser
│   ├── chunker.ts      # Text chunking
│   └── fileUtils.ts    # File hashing, mtime detection
└── embeddings/
    └── client.ts       # Unix socket client for embedding server
```

## License

MIT
