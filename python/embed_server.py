#!/usr/bin/env python3
"""
MLX Qwen3 Embedding Server for Apple Silicon
Based on qwen3-embeddings-mlx (https://github.com/jakedahn/qwen3-embeddings-mlx)

Provides REST API for generating text embeddings using Qwen3 models on Apple Silicon.
"""

import os
import sys
import time
import logging
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

# Check for Apple Silicon before importing MLX
import platform
if platform.system() != "Darwin" or platform.machine() != "arm64":
    print("Error: This server requires Apple Silicon (M1/M2/M3/M4)", file=sys.stderr)
    sys.exit(1)

try:
    import mlx.core as mx
    import mlx.nn as nn
    from mlx_lm import load
except ImportError as e:
    print(f"Error: MLX not installed. Run: pip install mlx-lm", file=sys.stderr)
    sys.exit(1)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import numpy as np
import uvicorn

# Configuration
MODEL_NAME = os.environ.get("MODEL_NAME", "mlx-community/Qwen3-Embedding-0.6B-4bit-DWQ")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
MAX_TEXT_LENGTH = int(os.environ.get("MAX_TEXT_LENGTH", "8192"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class EmbeddingModel:
    """Manages the Qwen3 embedding model lifecycle."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.model_name: Optional[str] = None
        self.embedding_dim: Optional[int] = None
        self._lock = asyncio.Lock()
        self._ready = False

    async def load(self, model_name: str) -> None:
        """Load the embedding model."""
        async with self._lock:
            if self.model_name == model_name and self._ready:
                return

            logger.info(f"Loading model: {model_name}")
            start = time.time()

            try:
                self.model, self.tokenizer = load(model_name)
                self.model_name = model_name

                # Determine embedding dimension from model config
                if hasattr(self.model, 'config'):
                    self.embedding_dim = getattr(self.model.config, 'hidden_size', 1024)
                else:
                    self.embedding_dim = 1024

                # Warmup inference
                await self._warmup()

                self._ready = True
                logger.info(f"Model loaded in {time.time() - start:.2f}s (dim={self.embedding_dim})")

            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                raise

    async def _warmup(self) -> None:
        """Run warmup inference to compile Metal kernels."""
        test_texts = ["warmup", "test"]
        for text in test_texts:
            tokens = self.tokenizer.encode(text, return_tensors="np")
            input_ids = mx.array(tokens)
            hidden = self._get_hidden_states(input_ids)
            # Force computation with mx.eval
            mx.eval(hidden)

    def _get_hidden_states(self, input_ids: mx.array) -> mx.array:
        """Extract hidden states from the model."""
        # Get embeddings from token embedding layer
        if hasattr(self.model.model, 'embed_tokens'):
            hidden_states = self.model.model.embed_tokens(input_ids)
        else:
            hidden_states = self.model.model.wte(input_ids)

        # Pass through transformer layers
        for layer in self.model.model.layers:
            hidden_states = layer(hidden_states, mask=None)[0] if isinstance(
                layer(hidden_states, mask=None), tuple
            ) else layer(hidden_states, mask=None)

        # Apply final layer norm
        if hasattr(self.model.model, 'norm'):
            hidden_states = self.model.model.norm(hidden_states)

        return hidden_states

    def generate_embedding(self, text: str, normalize: bool = True) -> np.ndarray:
        """Generate embedding for a single text."""
        if not self._ready:
            raise RuntimeError("Model not loaded")

        # Tokenize with truncation
        tokens = self.tokenizer.encode(
            text,
            max_length=MAX_TEXT_LENGTH,
            truncation=True,
            return_tensors="np"
        )
        input_ids = mx.array(tokens)

        # Get hidden states
        hidden_states = self._get_hidden_states(input_ids)

        # Mean pooling across sequence dimension
        embedding = mx.mean(hidden_states, axis=1)

        # L2 normalize
        if normalize:
            embedding = embedding / mx.linalg.norm(embedding, axis=-1, keepdims=True)

        # Force computation and convert to numpy via tolist()
        mx.eval(embedding)
        return np.array(embedding.tolist()[0], dtype=np.float32)

    def generate_embeddings_batch(self, texts: list[str], normalize: bool = True) -> list[np.ndarray]:
        """Generate embeddings for multiple texts."""
        return [self.generate_embedding(text, normalize) for text in texts]


# Global model instance
embedding_model = EmbeddingModel()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info(f"Starting Qwen3 Embedding Server on {HOST}:{PORT}")
    await embedding_model.load(MODEL_NAME)
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Qwen3 Embedding Server",
    description="MLX-powered embedding server for Apple Silicon",
    lifespan=lifespan
)


# Request/Response Models
class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)
    normalize: bool = True


class EmbedBatchRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=1024)
    normalize: bool = True


class EmbedResponse(BaseModel):
    embedding: list[float]
    tokens: int
    model: str


class EmbedBatchResponse(BaseModel):
    embeddings: list[dict]
    model: str


class HealthResponse(BaseModel):
    status: str
    model: Optional[str] = None
    model_name: Optional[str] = None
    dim: Optional[int] = None
    embedding_dim: Optional[int] = None


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    if embedding_model._ready:
        return HealthResponse(
            status="ok",
            model=embedding_model.model_name,
            model_name=embedding_model.model_name,
            dim=embedding_model.embedding_dim,
            embedding_dim=embedding_model.embedding_dim
        )
    return HealthResponse(status="loading")


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """Generate embedding for a single text."""
    if not embedding_model._ready:
        raise HTTPException(status_code=503, detail="Model not ready")

    try:
        start = time.time()
        embedding = embedding_model.generate_embedding(request.text, request.normalize)
        tokens = len(embedding_model.tokenizer.encode(request.text))

        logger.debug(f"Embedded {tokens} tokens in {(time.time()-start)*1000:.1f}ms")

        return EmbedResponse(
            embedding=embedding.tolist(),
            tokens=tokens,
            model=embedding_model.model_name
        )
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed_batch", response_model=EmbedBatchResponse)
async def embed_batch(request: EmbedBatchRequest):
    """Generate embeddings for multiple texts."""
    if not embedding_model._ready:
        raise HTTPException(status_code=503, detail="Model not ready")

    try:
        start = time.time()
        embeddings = embedding_model.generate_embeddings_batch(request.texts, request.normalize)

        results = []
        for i, (text, emb) in enumerate(zip(request.texts, embeddings)):
            tokens = len(embedding_model.tokenizer.encode(text))
            results.append({
                "embedding": emb.tolist(),
                "tokens": tokens
            })

        logger.debug(f"Batch embedded {len(request.texts)} texts in {(time.time()-start)*1000:.1f}ms")

        return EmbedBatchResponse(
            embeddings=results,
            model=embedding_model.model_name
        )
    except Exception as e:
        logger.error(f"Batch embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower())
