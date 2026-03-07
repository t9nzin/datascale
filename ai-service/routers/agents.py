"""AI Agent endpoints for natural-language annotation, quality review, and dataset health."""

from __future__ import annotations

import logging
import math
import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

import numpy as np
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from models import DEVICE, get_clip_model, get_clip_preprocess, get_clip_tokenizer, get_sam_model
from utils import (
    compute_iou,
    crop_region,
    image_from_upload,
    mask_to_polygon,
    mask_to_rle,
)

logger = logging.getLogger("dataTail.agents")
router = APIRouter(prefix="/agent", tags=["agents"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _clip_encode_image_pil(pil_img) -> np.ndarray:
    preprocess = get_clip_preprocess()
    model = get_clip_model()
    img_tensor = preprocess(pil_img).unsqueeze(0).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_image(img_tensor)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def _clip_encode_text(texts: list[str]) -> np.ndarray:
    tokenizer = get_clip_tokenizer()
    model = get_clip_model()
    tokens = tokenizer(texts).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_text(tokens)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()


def _segment_everything(np_img: np.ndarray, points_per_side: int = 32) -> list[dict]:
    from segment_anything import SamAutomaticMaskGenerator  # type: ignore

    sam_model = get_sam_model()
    generator = SamAutomaticMaskGenerator(
        model=sam_model,
        points_per_side=points_per_side,
        pred_iou_thresh=0.86,
        stability_score_thresh=0.92,
        min_mask_region_area=100,
    )
    return generator.generate(np_img)


# ---------------------------------------------------------------------------
# POST /agent/nl-annotate
# ---------------------------------------------------------------------------

class NLAnnotateMatch(BaseModel):
    label: str
    confidence: float
    bbox: List[int]  # [x, y, w, h]
    polygon: List[List[int]]
    rle: Dict[str, Any]


class NLAnnotateResponse(BaseModel):
    command: str
    parsed_query: str
    matches: List[NLAnnotateMatch]
    total_segments: int


_ANNOTATE_PATTERNS = [
    # "annotate all cars", "find every person", "select all dogs"
    re.compile(r"(?:annotate|find|select|detect|label|mark)\s+(?:all|every|each)?\s*(.+)", re.I),
    # "how many cars", "count the dogs"
    re.compile(r"(?:how many|count(?:\s+the)?)\s+(.+)", re.I),
]


def _parse_command(command: str) -> str:
    """Extract the target noun/phrase from a natural-language command."""
    for pattern in _ANNOTATE_PATTERNS:
        m = pattern.match(command.strip())
        if m:
            return m.group(1).strip().rstrip("?.,!")
    # Fallback: use the whole command as a query.
    return command.strip()


@router.post("/nl-annotate", response_model=NLAnnotateResponse)
async def nl_annotate(
    image: UploadFile = File(...),
    command: str = Form(...),
    threshold: float = Form(0.25),
):
    """Natural-language annotation: segment the image, classify each segment,
    and return those matching the command.

    Examples of *command*:
    - ``"annotate all cars"``
    - ``"how many people are there?"``
    - ``"find every dog"``
    """
    query_noun = _parse_command(command)
    if not query_noun:
        raise HTTPException(status_code=422, detail="Could not parse a target from the command")

    pil_img, np_img = await image_from_upload(image)

    # 1. Segment everything.
    masks_data = _segment_everything(np_img, points_per_side=32)

    # 2. Encode target text once.
    text_emb = _clip_encode_text([query_noun, "other", "background"])  # (3, D)
    target_vec = text_emb[0]  # the query noun vector

    # 3. Score each segment.
    matches: List[NLAnnotateMatch] = []
    for entry in masks_data:
        x, y, w, h = [int(v) for v in entry["bbox"]]
        # Guard against degenerate crops.
        if w < 2 or h < 2:
            continue

        crop = pil_img.crop((x, y, x + w, y + h))
        img_emb = _clip_encode_image_pil(crop)

        # Cosine similarity with all text embeddings -> softmax.
        sims = text_emb @ img_emb  # (3,)
        exp = np.exp(sims - sims.max())
        probs = exp / exp.sum()
        confidence = float(probs[0])

        if confidence >= threshold:
            binary = entry["segmentation"].astype(np.uint8)
            matches.append(
                NLAnnotateMatch(
                    label=query_noun,
                    confidence=confidence,
                    bbox=[x, y, w, h],
                    polygon=mask_to_polygon(binary),
                    rle=mask_to_rle(binary),
                )
            )

    matches.sort(key=lambda m: m.confidence, reverse=True)

    return NLAnnotateResponse(
        command=command,
        parsed_query=query_noun,
        matches=matches,
        total_segments=len(masks_data),
    )


# ---------------------------------------------------------------------------
# POST /agent/quality-review
# ---------------------------------------------------------------------------

class QualityIssue(BaseModel):
    type: str  # "label_mismatch" | "missing_annotation" | "geometric_anomaly"
    severity: str  # "high" | "medium" | "low"
    message: str
    annotation_id: Optional[str] = None
    suggestion: Optional[str] = None


class QualityReviewResponse(BaseModel):
    issues: List[QualityIssue]
    summary: str


@router.post("/quality-review", response_model=QualityReviewResponse)
async def quality_review(
    image: UploadFile = File(...),
    annotations: str = Form(...),
):
    """Review annotation quality on an image.

    *annotations*: JSON list of ``{"label": str, "bbox": {x, y, w, h} | None,
    "polygon": [[x,y],...] | None, "id": str}``.

    Checks performed:
    a. Label-region consistency via CLIP
    b. Missing annotation detection via SAM segment-everything
    c. Geometric anomalies (aspect ratio, size, overlap)
    """
    import json

    try:
        annot_list: list[dict] = json.loads(annotations)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in annotations: {exc}")

    pil_img, np_img = await image_from_upload(image)
    img_w, img_h = pil_img.size

    issues: List[QualityIssue] = []

    all_labels = list({a["label"] for a in annot_list if "label" in a})

    # --- a) Label-region consistency ---
    for ann in annot_list:
        bbox = ann.get("bbox")
        if not bbox:
            continue
        ann_id = ann.get("id", "unknown")
        label = ann.get("label", "")

        try:
            crop = crop_region(pil_img, bbox)
        except Exception:
            issues.append(QualityIssue(
                type="geometric_anomaly",
                severity="high",
                message=f"Annotation {ann_id} has an invalid bounding box.",
                annotation_id=ann_id,
                suggestion="Fix the bounding box coordinates.",
            ))
            continue

        if crop.width < 2 or crop.height < 2:
            continue

        img_emb = _clip_encode_image_pil(crop)
        candidate_labels = all_labels if len(all_labels) > 1 else [label, "other"]
        text_emb = _clip_encode_text(candidate_labels)
        sims = text_emb @ img_emb
        exp = np.exp(sims - sims.max())
        probs = exp / exp.sum()

        label_idx = candidate_labels.index(label) if label in candidate_labels else -1
        if label_idx >= 0:
            label_prob = float(probs[label_idx])
            best_idx = int(np.argmax(probs))
            if best_idx != label_idx and float(probs[best_idx]) > label_prob * 1.5:
                issues.append(QualityIssue(
                    type="label_mismatch",
                    severity="high",
                    message=(
                        f"Annotation '{ann_id}' labelled as '{label}' "
                        f"(score {label_prob:.2f}), but CLIP thinks it is "
                        f"'{candidate_labels[best_idx]}' (score {probs[best_idx]:.2f})."
                    ),
                    annotation_id=ann_id,
                    suggestion=f"Consider re-labelling to '{candidate_labels[best_idx]}'.",
                ))

    # --- b) Missing annotation detection ---
    try:
        masks_data = _segment_everything(np_img, points_per_side=16)  # coarser for speed
    except Exception as exc:
        logger.warning("SAM segment-everything failed during quality review: %s", exc)
        masks_data = []

    for seg in masks_data:
        sx, sy, sw, sh = [int(v) for v in seg["bbox"]]
        seg_area = int(seg["area"])
        # Skip tiny segments.
        if seg_area < 0.005 * img_w * img_h:
            continue

        # Check IoU against all annotated bboxes.
        matched = False
        for ann in annot_list:
            abbox = ann.get("bbox")
            if not abbox:
                continue
            # Simple bbox IoU.
            ax, ay, aw, ah = abbox["x"], abbox["y"], abbox["w"], abbox["h"]
            ix1 = max(sx, ax)
            iy1 = max(sy, ay)
            ix2 = min(sx + sw, ax + aw)
            iy2 = min(sy + sh, ay + ah)
            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                union = sw * sh + aw * ah - inter
                if union > 0 and inter / union > 0.3:
                    matched = True
                    break
        if not matched:
            issues.append(QualityIssue(
                type="missing_annotation",
                severity="medium",
                message=(
                    f"Detected unannotated region at bbox [{sx}, {sy}, {sw}, {sh}] "
                    f"with area {seg_area}."
                ),
                suggestion="Review this region and add an annotation if needed.",
            ))

    # --- c) Geometric anomalies ---
    areas = []
    for ann in annot_list:
        bbox = ann.get("bbox")
        if not bbox:
            continue
        ann_id = ann.get("id", "unknown")
        w, h = bbox["w"], bbox["h"]
        area = w * h
        areas.append(area)

        # Extreme aspect ratio.
        ar = max(w, h) / max(min(w, h), 1)
        if ar > 10:
            issues.append(QualityIssue(
                type="geometric_anomaly",
                severity="low",
                message=f"Annotation '{ann_id}' has extreme aspect ratio {ar:.1f}.",
                annotation_id=ann_id,
                suggestion="Verify the bounding box dimensions.",
            ))

        # Tiny annotation.
        if area < 0.001 * img_w * img_h:
            issues.append(QualityIssue(
                type="geometric_anomaly",
                severity="low",
                message=f"Annotation '{ann_id}' is very small ({w}x{h} px).",
                annotation_id=ann_id,
                suggestion="Verify this annotation is intentional.",
            ))

    # Check pairwise overlap (high IoU = potential duplicate).
    for i, a1 in enumerate(annot_list):
        b1 = a1.get("bbox")
        if not b1:
            continue
        for j, a2 in enumerate(annot_list):
            if j <= i:
                continue
            b2 = a2.get("bbox")
            if not b2:
                continue
            ix1 = max(b1["x"], b2["x"])
            iy1 = max(b1["y"], b2["y"])
            ix2 = min(b1["x"] + b1["w"], b2["x"] + b2["w"])
            iy2 = min(b1["y"] + b1["h"], b2["y"] + b2["h"])
            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                area1 = b1["w"] * b1["h"]
                area2 = b2["w"] * b2["h"]
                union = area1 + area2 - inter
                if union > 0 and inter / union > 0.7:
                    issues.append(QualityIssue(
                        type="geometric_anomaly",
                        severity="medium",
                        message=(
                            f"Annotations '{a1.get('id', i)}' and '{a2.get('id', j)}' "
                            f"have high overlap (IoU {inter / union:.2f}). Possible duplicate."
                        ),
                        annotation_id=a1.get("id"),
                        suggestion="Remove one if they refer to the same object.",
                    ))

    # Sort by severity.
    severity_order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda x: severity_order.get(x.severity, 3))

    summary = (
        f"Found {len(issues)} issue(s) across {len(annot_list)} annotation(s): "
        f"{sum(1 for i in issues if i.severity == 'high')} high, "
        f"{sum(1 for i in issues if i.severity == 'medium')} medium, "
        f"{sum(1 for i in issues if i.severity == 'low')} low."
    )

    return QualityReviewResponse(issues=issues, summary=summary)


# ---------------------------------------------------------------------------
# POST /agent/dataset-health
# ---------------------------------------------------------------------------

class AnnotatorStats(BaseModel):
    annotator: str
    count: int
    labels: Dict[str, int]


class DatasetHealthResponse(BaseModel):
    total_annotations: int
    total_images: int
    class_distribution: Dict[str, int]
    class_percentages: Dict[str, float]
    images_annotated: int
    images_unannotated: int
    annotation_progress: float  # 0-1
    per_annotator: List[AnnotatorStats]
    quality_score: float  # 0-100
    warnings: List[str]


@router.post("/dataset-health", response_model=DatasetHealthResponse)
async def dataset_health(
    annotations: str = Form(...),
    total_images: int = Form(0),
    image_embeddings: str = Form("[]"),
):
    """Compute dataset health statistics.

    *annotations*: JSON list of ``{"image_id": str, "label": str, "bbox": ...,
    "annotator": str | None}``.
    *total_images*: total number of images in the dataset (for progress calc).
    *image_embeddings*: optional JSON list of ``{"image_id": str, "embedding": [...]}``.
    """
    import json

    try:
        annot_list: list[dict] = json.loads(annotations)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in annotations: {exc}")

    try:
        embeddings_list: list[dict] = json.loads(image_embeddings)
    except (json.JSONDecodeError, TypeError):
        embeddings_list = []

    total_annots = len(annot_list)
    warnings: list[str] = []

    # --- Class distribution ---
    label_counts: Counter = Counter()
    for a in annot_list:
        label_counts[a.get("label", "unlabelled")] += 1

    class_distribution = dict(label_counts.most_common())
    total_labels = sum(label_counts.values()) or 1
    class_percentages = {lbl: round(cnt / total_labels * 100, 2) for lbl, cnt in class_distribution.items()}

    # Warn on imbalanced classes.
    if len(label_counts) > 1:
        most_common_count = label_counts.most_common(1)[0][1]
        least_common_count = label_counts.most_common()[-1][1]
        if most_common_count > 5 * least_common_count:
            warnings.append(
                f"Class imbalance detected: most common class has {most_common_count} "
                f"annotations vs {least_common_count} for the least common."
            )

    # --- Annotation progress ---
    image_ids = {a.get("image_id") for a in annot_list if a.get("image_id")}
    images_annotated = len(image_ids)
    if total_images <= 0:
        total_images = max(images_annotated, 1)
    images_unannotated = max(total_images - images_annotated, 0)
    annotation_progress = round(images_annotated / total_images, 4)

    if annotation_progress < 0.5:
        warnings.append(
            f"Only {annotation_progress * 100:.1f}% of images have been annotated."
        )

    # --- Per-annotator stats ---
    annotator_map: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    annotator_counts: Counter = Counter()
    for a in annot_list:
        annotator = a.get("annotator", "unknown")
        annotator_counts[annotator] += 1
        annotator_map[annotator][a.get("label", "unlabelled")] += 1

    per_annotator = [
        AnnotatorStats(
            annotator=name,
            count=annotator_counts[name],
            labels=dict(annotator_map[name]),
        )
        for name in sorted(annotator_counts)
    ]

    # Warn if an annotator has very few annotations compared to average.
    if len(annotator_counts) > 1:
        avg_count = total_annots / len(annotator_counts)
        for name, count in annotator_counts.items():
            if count < avg_count * 0.2:
                warnings.append(
                    f"Annotator '{name}' has significantly fewer annotations "
                    f"({count}) than average ({avg_count:.0f})."
                )

    # --- Quality score ---
    # Heuristic score 0-100 based on progress, class balance, coverage.
    score = 100.0
    # Penalise low progress.
    score -= max(0, (1 - annotation_progress) * 30)
    # Penalise class imbalance.
    if len(label_counts) > 1:
        values = list(label_counts.values())
        std = float(np.std(values))
        mean = float(np.mean(values))
        cv = std / mean if mean > 0 else 0
        score -= min(cv * 20, 30)
    # Penalise very few annotations.
    if total_annots < 10:
        score -= 20
    elif total_annots < 50:
        score -= 10

    quality_score = round(max(0.0, min(100.0, score)), 1)

    if quality_score < 50:
        warnings.append("Overall dataset quality score is low. Consider adding more annotations.")

    return DatasetHealthResponse(
        total_annotations=total_annots,
        total_images=total_images,
        class_distribution=class_distribution,
        class_percentages=class_percentages,
        images_annotated=images_annotated,
        images_unannotated=images_unannotated,
        annotation_progress=annotation_progress,
        per_annotator=per_annotator,
        quality_score=quality_score,
        warnings=warnings,
    )
