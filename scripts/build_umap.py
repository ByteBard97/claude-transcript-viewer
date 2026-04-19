#!/usr/bin/env python3
"""
UMAP preprocessing pipeline for Session Search.

Reads conversation text from the transcript-viewer SQLite DB, embeds each
conversation via the local MLX embed server (port 8100), then runs UMAP
twice per project (2D + 3D) and HDBSCAN for cluster detection.

Outputs 4 JSON files to public/umap/:
  signalcanvas-2d.json
  signalcanvas-3d.json
  flora-2d.json
  flora-3d.json
"""

import json
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import hdbscan
import umap

DB_PATH = Path.home() / ".claude/transcript-archive/.search.db"
EMBED_URL = "http://localhost:8100/embed_batch"
OUT_DIR = Path(__file__).parent.parent / "public" / "umap"
BATCH_SIZE = 16
MAX_TEXT_CHARS = 6000  # truncate long conversations before embedding

PROJECT_SIGNALCANVAS = "-Users-ceres-Desktop-SignalCanvas"
PROJECT_FLORA = "-Users-ceres-Desktop-flora-flora-uxp"

UMAP_PARAMS = dict(
    n_neighbors=15,
    min_dist=0.1,
    metric="cosine",
    random_state=42,
    low_memory=False,
)

HDBSCAN_PARAMS = dict(
    min_cluster_size=8,
    min_samples=3,
    metric="euclidean",
    cluster_selection_method="eom",
)


def load_conversations(db: sqlite3.Connection, project: str) -> list[dict]:
    rows = db.execute(
        """
        SELECT c.id, c.title, c.created_at,
               GROUP_CONCAT(ch.content, ' ') AS text
        FROM conversations c
        JOIN chunks ch ON ch.conversation_id = c.id
        WHERE c.project = ?
        GROUP BY c.id
        ORDER BY c.created_at
        """,
        (project,),
    ).fetchall()
    return [
        {
            "id": r[0],
            "title": r[1] or "",
            "created_at": r[2] or "",
            "text": (r[3] or "")[:MAX_TEXT_CHARS],
        }
        for r in rows
    ]


def embed_texts(texts: list[str]) -> list[list[float]]:
    payload = json.dumps({"texts": texts}).encode()
    req = urllib.request.Request(
        EMBED_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
    return result["embeddings"]


def embed_all(convs: list[dict]) -> np.ndarray:
    embeddings = []
    total = len(convs)
    for i in range(0, total, BATCH_SIZE):
        batch = convs[i : i + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        vecs = embed_texts(texts)
        embeddings.extend(vecs)
        done = min(i + BATCH_SIZE, total)
        print(f"  embedded {done}/{total}", end="\r", flush=True)
    print()
    return np.array(embeddings, dtype=np.float32)


def run_umap(embeddings: np.ndarray, n_components: int) -> np.ndarray:
    reducer = umap.UMAP(n_components=n_components, **UMAP_PARAMS)
    return reducer.fit_transform(embeddings)


def run_hdbscan(coords: np.ndarray) -> np.ndarray:
    clusterer = hdbscan.HDBSCAN(**HDBSCAN_PARAMS)
    return clusterer.fit_predict(coords)


def build_output(convs: list[dict], coords: np.ndarray, labels: np.ndarray, n_components: int) -> dict:
    points = []
    for i, conv in enumerate(convs):
        point = {
            "id": conv["id"],
            "title": conv["title"].replace("**", "").strip(),
            "created_at": conv["created_at"],
            "cluster": int(labels[i]),
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
        }
        if n_components == 3:
            point["z"] = float(coords[i, 2])
        points.append(point)

    # Build cluster summaries (exclude noise cluster -1)
    cluster_ids = sorted(set(int(l) for l in labels if l >= 0))
    clusters = []
    for cid in cluster_ids:
        members = [p for p in points if p["cluster"] == cid]
        clusters.append({
            "id": cid,
            "count": len(members),
            "label": f"Cluster {cid + 1}",
        })

    return {
        "dimensions": n_components,
        "total": len(points),
        "noise_count": int(np.sum(labels == -1)),
        "clusters": clusters,
        "points": points,
    }


def process_project(db: sqlite3.Connection, project: str, slug: str) -> None:
    print(f"\n=== {slug} ===")
    print("Loading conversations...")
    convs = load_conversations(db, project)
    print(f"  {len(convs)} conversations")

    if len(convs) < 10:
        print("  Too few conversations, skipping.")
        return

    print("Embedding conversations...")
    embeddings = embed_all(convs)

    for n_dims in (2, 3):
        print(f"Running UMAP {n_dims}D...")
        t0 = time.time()
        coords = run_umap(embeddings, n_dims)
        print(f"  done in {time.time()-t0:.1f}s")

        print(f"Running HDBSCAN on {n_dims}D coords...")
        labels = run_hdbscan(coords)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        print(f"  {n_clusters} clusters, {int(np.sum(labels==-1))} noise points")

        out = build_output(convs, coords, labels, n_dims)
        out_path = OUT_DIR / f"{slug}-{n_dims}d.json"
        out_path.write_text(json.dumps(out, separators=(",", ":")))
        print(f"  → {out_path}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = None  # plain tuples

    # Verify embed server is reachable
    try:
        req = urllib.request.Request("http://localhost:8100/health", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            health = json.loads(resp.read())
        print(f"Embed server ready: dim={health['dim']}")
    except Exception as e:
        print(f"ERROR: embed server not reachable on port 8100: {e}", file=sys.stderr)
        sys.exit(1)

    process_project(db, PROJECT_SIGNALCANVAS, "signalcanvas")
    process_project(db, PROJECT_FLORA, "flora")

    print("\nDone.")


if __name__ == "__main__":
    main()
