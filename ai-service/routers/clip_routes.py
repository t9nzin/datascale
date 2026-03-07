"""CLIP classification and embedding endpoints."""

from __future__ import annotations

import logging
from typing import Any, List

import numpy as np
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from models import DEVICE, get_clip_model, get_clip_preprocess, get_clip_tokenizer
from utils import crop_region, image_from_upload

logger = logging.getLogger("dataTail.clip")
router = APIRouter(prefix="/clip", tags=["clip"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _encode_image(pil_img) -> np.ndarray:
    """Encode a PIL image to a normalised CLIP embedding vector."""
    preprocess = get_clip_preprocess()
    model = get_clip_model()

    img_tensor = preprocess(pil_img).unsqueeze(0).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_image(img_tensor)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def _encode_text(texts: list[str]) -> np.ndarray:
    """Encode a list of text strings to normalised CLIP embeddings."""
    tokenizer = get_clip_tokenizer()
    model = get_clip_model()

    tokens = tokenizer(texts).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_text(tokens)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()


# ---------------------------------------------------------------------------
# POST /clip/classify
# ---------------------------------------------------------------------------

class ClassifyResult(BaseModel):
    label: str
    score: float


@router.post("/classify", response_model=List[ClassifyResult])
async def clip_classify(
    image: UploadFile = File(...),
    labels: str = Form(...),
):
    """Classify an image against a set of candidate labels.

    *labels*: JSON list of strings, e.g. ``["cat", "dog", "car"]``.
    Returns scores sorted by descending confidence.
    """
    import json

    try:
        label_list: list[str] = json.loads(labels)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in labels: {exc}")

    if not label_list:
        raise HTTPException(status_code=422, detail="At least one label is required")

    pil_img, _ = await image_from_upload(image)

    img_emb = _encode_image(pil_img)          # (D,)
    text_emb = _encode_text(label_list)        # (N, D)

    similarities = text_emb @ img_emb          # (N,)

    # Softmax for interpretable scores.
    exp = np.exp(similarities - similarities.max())
    probs = exp / exp.sum()

    results = [
        ClassifyResult(label=lbl, score=float(prob))
        for lbl, prob in zip(label_list, probs)
    ]
    return sorted(results, key=lambda r: r.score, reverse=True)


# ---------------------------------------------------------------------------
# POST /clip/embed
# ---------------------------------------------------------------------------

@router.post("/embed")
async def clip_embed(image: UploadFile = File(...)):
    """Return the CLIP embedding vector for an image."""
    pil_img, _ = await image_from_upload(image)
    embedding = _encode_image(pil_img)
    return {"embedding": embedding.tolist()}


# ---------------------------------------------------------------------------
# POST /clip/search
# ---------------------------------------------------------------------------

class EmbeddingEntry(BaseModel):
    image_id: str
    embedding: List[float]


class SearchResultItem(BaseModel):
    image_id: str
    score: float


@router.post("/search", response_model=List[SearchResultItem])
async def clip_search(
    query: str = Form(...),
    embeddings: str = Form(...),
):
    """Rank a set of pre-computed image embeddings by text query similarity.

    *query*: natural-language search string.
    *embeddings*: JSON list of ``{"image_id": str, "embedding": [float, ...]}``.
    """
    import json

    try:
        entries: list[dict] = json.loads(embeddings)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in embeddings: {exc}")

    if not entries:
        raise HTTPException(status_code=422, detail="At least one embedding is required")

    text_emb = _encode_text([query])  # (1, D)
    text_vec = text_emb.flatten()     # (D,)

    results: list[SearchResultItem] = []
    for entry in entries:
        img_vec = np.array(entry["embedding"], dtype=np.float32)
        norm = np.linalg.norm(img_vec)
        if norm > 0:
            img_vec = img_vec / norm
        score = float(np.dot(text_vec, img_vec))
        results.append(SearchResultItem(image_id=entry["image_id"], score=score))

    return sorted(results, key=lambda r: r.score, reverse=True)


# ---------------------------------------------------------------------------
# POST /clip/classify-regions
# ---------------------------------------------------------------------------

class RegionBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class RegionClassification(BaseModel):
    region: RegionBox
    scores: List[ClassifyResult]


@router.post("/classify-regions", response_model=List[RegionClassification])
async def clip_classify_regions(
    image: UploadFile = File(...),
    regions: str = Form(...),
    labels: str = Form(...),
):
    """CLIP-classify multiple cropped regions of an image.

    *regions*: JSON list of ``{"x", "y", "w", "h"}`` bbox dicts.
    *labels*: JSON list of candidate label strings.
    """
    import json

    try:
        region_list: list[dict] = json.loads(regions)
        label_list: list[str] = json.loads(labels)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {exc}")

    if not region_list:
        raise HTTPException(status_code=422, detail="At least one region is required")
    if not label_list:
        raise HTTPException(status_code=422, detail="At least one label is required")

    pil_img, _ = await image_from_upload(image)

    text_emb = _encode_text(label_list)  # (N, D)

    results: list[RegionClassification] = []
    for reg in region_list:
        try:
            crop = crop_region(pil_img, reg)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid region {reg}: {exc}")

        img_emb = _encode_image(crop)  # (D,)
        similarities = text_emb @ img_emb
        exp = np.exp(similarities - similarities.max())
        probs = exp / exp.sum()

        scores = sorted(
            [ClassifyResult(label=lbl, score=float(p)) for lbl, p in zip(label_list, probs)],
            key=lambda r: r.score,
            reverse=True,
        )
        results.append(
            RegionClassification(
                region=RegionBox(**reg),
                scores=scores,
            )
        )

    return results
