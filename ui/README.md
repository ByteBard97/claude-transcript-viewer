# Session Search UI

A Vue 3 frontend for claude-transcript-viewer with hybrid FTS + semantic search and a UMAP semantic map.

## Features

- **Search view** — hybrid full-text + semantic search across all indexed sessions, with project and role filters and live debounced results
- **Semantic Map** — 2D/3D UMAP scatter plot of conversation embeddings, segregated by project, with HDBSCAN cluster detection
- Dark theme matching Material Design 3 color system

## Prerequisites

- The [claude-transcript-viewer](https://github.com/varunr89/claude-transcript-viewer) backend running on `http://localhost:3000`
- Embeddings backfilled via `scripts/backfill_embeddings.py` (see below)
- UMAP data built via `scripts/build_umap.py`

## Setup

```bash
cd ui
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000`.

## Backfilling embeddings

If your archive was indexed without an embed server running, use the backfill script to populate vectors overnight:

```bash
python3 scripts/backfill_embeddings.py
```

Safe to interrupt and resume — skips already-embedded chunks.

## Building UMAP data

Once embeddings are backfilled, generate the UMAP JSON files for the semantic map:

```bash
python3 scripts/build_umap.py
```

Outputs to `ui/public/umap/`:
- `signalcanvas-2d.json` / `signalcanvas-3d.json`
- `flora-2d.json` / `flora-3d.json`

## Python dependencies

```bash
pip install umap-learn hdbscan numpy
```
