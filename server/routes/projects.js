import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// GET /api/projects — list all projects
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM images WHERE project_id = p.id) AS image_count,
      (SELECT COUNT(*) FROM annotations WHERE project_id = p.id) AS annotation_count,
      (SELECT COUNT(*) FROM label_classes WHERE project_id = p.id) AS label_count,
      (SELECT COUNT(*) FROM images WHERE project_id = p.id AND status = 'done') AS done_count,
      (SELECT i.id FROM images i WHERE i.project_id = p.id ORDER BY i.created_at DESC LIMIT 1) AS thumbnail_image_id
    FROM projects p
    ORDER BY p.updated_at DESC
  `).all();
  res.json(projects);
});

// POST /api/projects — create project
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, description, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', req.user || 'local-user', now, now);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// GET /api/projects/:id — get project with counts
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM images WHERE project_id = p.id) AS image_count,
      (SELECT COUNT(*) FROM annotations WHERE project_id = p.id) AS annotation_count,
      (SELECT COUNT(*) FROM label_classes WHERE project_id = p.id) AS label_count,
      (SELECT COUNT(*) FROM images WHERE project_id = p.id AND status = 'done') AS done_count
    FROM projects p WHERE p.id = ?
  `).get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

// GET /api/projects/:id/activity — contributor stats + recent activity
router.get('/:id/activity', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Per-contributor annotation counts
  const contributors = db.prepare(`
    SELECT created_by,
      COUNT(*) AS annotation_count,
      MAX(created_at) AS last_active
    FROM annotations WHERE project_id = ?
    GROUP BY created_by
    ORDER BY annotation_count DESC
  `).all(req.params.id);

  // Per-contributor image upload counts
  const uploaders = db.prepare(`
    SELECT uploaded_by,
      COUNT(*) AS image_count
    FROM images WHERE project_id = ?
    GROUP BY uploaded_by
  `).all(req.params.id);

  // Recent annotations (last 20)
  const recentActivity = db.prepare(`
    SELECT a.id, a.label, a.source, a.created_by, a.created_at,
      i.original_name AS image_name
    FROM annotations a
    JOIN images i ON a.image_id = i.id
    WHERE a.project_id = ?
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all(req.params.id);

  // Per-label class distribution
  const labelDistribution = db.prepare(`
    SELECT label, COUNT(*) AS count
    FROM annotations WHERE project_id = ? AND label IS NOT NULL
    GROUP BY label
    ORDER BY count DESC
  `).all(req.params.id);

  res.json({ contributors, uploaders, recentActivity, labelDistribution });
});

// PUT /api/projects/:id — update project
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found' });
  }

  db.prepare(`
    UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?
  `).run(name || existing.name, description ?? existing.description, now, req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// DELETE /api/projects/:id — delete project (cascade handled by FK)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found' });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
