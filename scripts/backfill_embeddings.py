#!/usr/bin/env python3
"""
Backfill embeddings for all chunks that have NULL embedding.

Reads chunks in batches, calls the MLX embed server, writes vectors
back to chunks.embedding (the existing DB trigger syncs to chunks_vec).

Run once overnight. Safe to interrupt and resume — skips already-embedded chunks.
"""

import json
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

DB_PATH = Path.home() / ".claude/transcript-archive/.search.db"
VEC0_EXT = Path("/Users/ceres/.npm/_npx/55034b0851817814/node_modules/sqlite-vec-darwin-arm64/vec0.dylib")
EMBED_URL = "http://localhost:8100/embed_batch"
BATCH_SIZE = 128
MAX_TEXT_CHARS = 4000


def embed_batch(texts: list[str]) -> list[list[float]]:
    payload = json.dumps({"texts": texts}).encode()
    req = urllib.request.Request(
        EMBED_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
    return [e["embedding"] for e in result["embeddings"]]


def main() -> None:
    db = sqlite3.connect(str(DB_PATH))
    db.enable_load_extension(True)
    db.load_extension(str(VEC0_EXT))

    total_null = db.execute("SELECT COUNT(*) FROM chunks WHERE embedding IS NULL").fetchone()[0]
    print(f"Chunks to embed: {total_null:,}")

    if total_null == 0:
        print("Nothing to do.")
        return

    done = 0
    t_start = time.time()

    while True:
        rows = db.execute(
            "SELECT id, content FROM chunks WHERE embedding IS NULL LIMIT ?",
            (BATCH_SIZE,),
        ).fetchall()

        if not rows:
            break

        ids = [r[0] for r in rows]
        texts = [r[1][:MAX_TEXT_CHARS] for r in rows]

        try:
            embeddings = embed_batch(texts)
        except Exception as e:
            print(f"\nEmbed error: {e} — retrying in 5s")
            time.sleep(5)
            continue

        for chunk_id, embedding in zip(ids, embeddings):
            blob = __import__("struct").pack(f"{len(embedding)}f", *embedding)
            db.execute("UPDATE chunks SET embedding = ? WHERE id = ?", (blob, chunk_id))

        db.commit()
        done += len(rows)

        elapsed = time.time() - t_start
        rate = done / elapsed
        remaining = (total_null - done) / rate if rate > 0 else 0
        hrs, mins = divmod(int(remaining), 3600)
        mins //= 60
        print(
            f"  {done:>8,} / {total_null:,}  ({100*done/total_null:.1f}%)  "
            f"{rate:.0f} chunks/s  ETA {hrs}h{mins:02d}m",
            end="\r",
            flush=True,
        )

    print(f"\nDone. {done:,} chunks embedded in {(time.time()-t_start)/3600:.1f}h")


if __name__ == "__main__":
    main()
