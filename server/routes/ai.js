import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsBase = path.join(__dirname, '..', '..', 'uploads');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

const router = Router();

/**
 * Helper: look up an image by ID, return its file path and metadata.
 */
function getImageFile(imageId) {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
  if (!image) return null;
  const filePath = path.join(uploadsBase, image.project_id, image.filename);
  if (!fs.existsSync(filePath)) return null;
  return { image, filePath };
}

/**
 * Helper: proxy a JSON request body to the AI service.
 */
async function proxyJson(endpoint, body) {
  const resp = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI service error (${resp.status}): ${text}`);
  }
  return resp.json();
}

/**
 * Helper: proxy a request with an image file as multipart form data.
 * Reads the image from disk by image_id and forwards it along with other fields.
 */
async function proxyWithImage(endpoint, imageId, extraFields = {}) {
  const imageFile = getImageFile(imageId);
  if (!imageFile) {
    throw new Error('Image not found');
  }

  const { Blob } = await import('buffer');
  const fileBuffer = fs.readFileSync(imageFile.filePath);
  const ext = path.extname(imageFile.image.filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('image', blob, imageFile.image.filename);

  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  const resp = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI service error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// POST /api/ai/segment/click
router.post('/segment/click', async (req, res, next) => {
  try {
    const { image_id, points, labels } = req.body;
    const result = await proxyWithImage('/segment/click', image_id, { points, labels });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/box
router.post('/segment/box', async (req, res, next) => {
  try {
    const { image_id, box } = req.body;
    const result = await proxyWithImage('/segment/box', image_id, { box });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/everything
router.post('/segment/everything', async (req, res, next) => {
  try {
    const { image_id, params } = req.body;
    const result = await proxyWithImage('/segment/everything', image_id, params || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/refine
router.post('/segment/refine', async (req, res, next) => {
  try {
    const { image_id, mask_rle, positive_points, negative_points } = req.body;
    const result = await proxyWithImage('/segment/refine', image_id, { mask_rle, positive_points, negative_points });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/classify
router.post('/clip/classify', async (req, res, next) => {
  try {
    const { image_id, labels: classLabels } = req.body;
    const result = await proxyWithImage('/clip/classify', image_id, { labels: classLabels });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/embed
router.post('/clip/embed', async (req, res, next) => {
  try {
    const { image_id } = req.body;
    const result = await proxyWithImage('/clip/embed', image_id);

    // Save embedding to the image record
    if (result.embedding) {
      db.prepare('UPDATE images SET clip_embedding = ? WHERE id = ?')
        .run(JSON.stringify(result.embedding), image_id);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/search
router.post('/clip/search', async (req, res, next) => {
  try {
    const { project_id, query } = req.body;

    // Get all images with embeddings for this project
    const images = db.prepare(
      'SELECT id, filename, clip_embedding FROM images WHERE project_id = ? AND clip_embedding IS NOT NULL'
    ).all(project_id);

    const embeddings = images.map((img) => ({
      image_id: img.id,
      embedding: JSON.parse(img.clip_embedding),
    }));

    const result = await proxyJson('/clip/search', { query, embeddings });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/nl-annotate — natural language annotation
router.post('/agent/nl-annotate', async (req, res, next) => {
  try {
    const { image_id, project_id, prompt } = req.body;
    const result = await proxyWithImage('/agent/nl-annotate', image_id, { prompt });

    // Auto-create annotations from results
    if (result.annotations && Array.isArray(result.annotations)) {
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO annotations (id, image_id, project_id, label, type, data, confidence, source, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAll = db.transaction((annotations) => {
        for (const ann of annotations) {
          const id = uuidv4();
          insertStmt.run(
            id,
            image_id,
            project_id,
            ann.label || null,
            ann.type || 'polygon',
            typeof ann.data === 'string' ? ann.data : JSON.stringify(ann.data),
            ann.confidence ?? null,
            'nl-agent',
            req.user || 'local-user',
            now,
            now
          );
        }
      });

      insertAll(result.annotations);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/quality-review — review annotations for quality
router.post('/agent/quality-review', async (req, res, next) => {
  try {
    const { image_id, project_id } = req.body;

    // Get annotations for the image
    const annotations = db.prepare(
      'SELECT * FROM annotations WHERE image_id = ?'
    ).all(image_id);

    const result = await proxyWithImage('/agent/quality-review', image_id, { annotations });

    // Save issues to review_issues table
    if (result.issues && Array.isArray(result.issues)) {
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO review_issues (id, project_id, image_id, annotation_id, type, severity, message, suggestion, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `);

      const insertAll = db.transaction((issues) => {
        for (const issue of issues) {
          insertStmt.run(
            uuidv4(),
            project_id,
            image_id,
            issue.annotation_id || null,
            issue.type || null,
            issue.severity || 'warning',
            issue.message,
            issue.suggestion || null,
            now
          );
        }
      });

      insertAll(result.issues);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/dataset-health — compute dataset health stats
router.post('/agent/dataset-health', async (req, res, next) => {
  try {
    const { project_id } = req.body;

    // Compute stats from DB
    const imageCount = db.prepare(
      'SELECT COUNT(*) AS count FROM images WHERE project_id = ?'
    ).get(project_id).count;

    const annotationCount = db.prepare(
      'SELECT COUNT(*) AS count FROM annotations WHERE project_id = ?'
    ).get(project_id).count;

    const labelDistribution = db.prepare(`
      SELECT label, COUNT(*) AS count
      FROM annotations WHERE project_id = ?
      GROUP BY label
    `).all(project_id);

    const sourceDistribution = db.prepare(`
      SELECT source, COUNT(*) AS count
      FROM annotations WHERE project_id = ?
      GROUP BY source
    `).all(project_id);

    const unannotatedImages = db.prepare(`
      SELECT COUNT(*) AS count FROM images
      WHERE project_id = ? AND id NOT IN (SELECT DISTINCT image_id FROM annotations WHERE project_id = ?)
    `).get(project_id, project_id).count;

    const openIssues = db.prepare(
      "SELECT COUNT(*) AS count FROM review_issues WHERE project_id = ? AND status = 'open'"
    ).get(project_id).count;

    const dbStats = {
      image_count: imageCount,
      annotation_count: annotationCount,
      label_distribution: labelDistribution,
      source_distribution: sourceDistribution,
      unannotated_images: unannotatedImages,
      open_issues: openIssues,
      avg_annotations_per_image: imageCount > 0 ? +(annotationCount / imageCount).toFixed(2) : 0,
    };

    // Try to get CLIP-based diversity stats from AI service
    try {
      const images = db.prepare(
        'SELECT id, clip_embedding FROM images WHERE project_id = ? AND clip_embedding IS NOT NULL'
      ).all(project_id);

      if (images.length > 0) {
        const embeddings = images.map((img) => ({
          image_id: img.id,
          embedding: JSON.parse(img.clip_embedding),
        }));
        const clipStats = await proxyJson('/agent/dataset-health', { embeddings });
        Object.assign(dbStats, { clip_analysis: clipStats });
      }
    } catch {
      // AI service may not be available, that's OK
    }

    res.json(dbStats);
  } catch (err) {
    next(err);
  }
});

export default router;
