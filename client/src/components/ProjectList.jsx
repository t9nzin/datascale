import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import * as api from '../api';

const ACCENT = '#6C5CE7';
const ACCENT_BG = 'rgba(108, 92, 231, 0.10)';
const TEXT_PRIMARY = '#555';
const TEXT_SECONDARY = '#888';
const TEXT_MUTED = '#aaa';
const BORDER = '#e5e5e5';

export default function ProjectList() {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLabels, setNewLabels] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.fetchProjects();
        setProjects(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setProjects]);

  function resetModal() {
    setNewName('');
    setNewDescription('');
    setNewLabels('');
    setImageFiles([]);
    setUploadStatus('');
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      setUploadStatus('Creating project...');
      const project = await api.createProject(newName.trim(), newDescription.trim());

      if (imageFiles.length > 0) {
        const BATCH = 50;
        for (let i = 0; i < imageFiles.length; i += BATCH) {
          const batch = imageFiles.slice(i, i + BATCH);
          setUploadStatus(`Uploading images ${i + 1}–${Math.min(i + BATCH, imageFiles.length)} of ${imageFiles.length}...`);
          await api.uploadImages(project.id, batch);
        }
      }

      const labelNames = newLabels.split(',').map((l) => l.trim()).filter(Boolean);
      if (labelNames.length > 0) {
        setUploadStatus('Creating label classes...');
        for (const name of labelNames) {
          await api.createLabel(project.id, name);
        }
      }

      setProjects([project, ...projects]);
      resetModal();
      setShowModal(false);
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err.message);
      setUploadStatus('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f0f0',
        color: TEXT_PRIMARY,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top navbar */}
      <div
        style={{
          height: 78,
          background: '#fff',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 36px',
          gap: 18,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill={ACCENT} />
            <path d="M6 18L12 6l6 12H6z" fill="white" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 24, color: TEXT_PRIMARY }}>dataTail</span>
        </div>

        <span style={{ flex: 1 }} />

        <div
          style={{
            padding: '4px 14px',
            background: ACCENT_BG,
            borderRadius: 20,
            fontSize: 16,
            fontWeight: 600,
            color: ACCENT,
          }}
        >
          Beta
        </div>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          LU
        </div>
      </div>

      {/* Page body */}
      <div style={{ padding: '48px 48px 60px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Welcome */}
        <h1 style={{ fontSize: 42, fontWeight: 700, color: TEXT_PRIMARY, margin: '0 0 8px 0', letterSpacing: -0.5 }}>
          Welcome
        </h1>
        <p style={{ fontSize: 21, color: TEXT_SECONDARY, margin: '0 0 36px 0' }}>
          Let's get you started with your annotation projects.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 28px',
              background: ACCENT,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 20,
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(108, 92, 231, 0.25)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#5a4bd6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ACCENT; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Project
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 28px',
              background: '#fff',
              color: ACCENT,
              border: `2px solid ${ACCENT}`,
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 20,
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ACCENT_BG; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Dataset
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(231,76,60,0.06)',
              border: '1px solid rgba(231,76,60,0.2)',
              borderRadius: 12,
              color: '#e74c3c',
              fontSize: 18,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Projects Grid */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY }}>
              Recent Projects
            </span>
            <span
              onClick={() => setShowModal(true)}
              style={{ fontSize: 18, color: ACCENT, cursor: 'pointer', fontWeight: 600 }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              + New Project
            </span>
          </div>

          {loading && (
            <div style={{ padding: '48px 0', color: TEXT_MUTED, fontSize: 20, textAlign: 'center' }}>
              Loading projects...
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div
              style={{
                padding: '64px 0',
                textAlign: 'center',
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: 20, color: TEXT_MUTED, marginBottom: 12 }}>
                No projects yet.
              </div>
              <span
                onClick={() => setShowModal(true)}
                style={{ fontSize: 20, color: ACCENT, cursor: 'pointer', fontWeight: 600 }}
              >
                Create your first project
              </span>
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 20 }}>
              {projects.map((project) => {
                const pct = project.image_count > 0
                  ? Math.round(((project.done_count ?? 0) / project.image_count) * 100)
                  : 0;
                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/project/${project.id}`)}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: '28px 28px 24px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      border: `1px solid transparent`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(108,92,231,0.15)';
                      e.currentTarget.style.borderColor = ACCENT;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>
                      {project.name}
                    </div>
                    {project.description && (
                      <div style={{ fontSize: 17, color: TEXT_SECONDARY, marginBottom: 16, lineHeight: 1.4 }}>
                        {project.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span style={{ fontSize: 17, color: TEXT_SECONDARY }}>{project.image_count ?? 0} images</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                          <circle cx="7" cy="7" r="1" />
                        </svg>
                        <span style={{ fontSize: 17, color: TEXT_SECONDARY }}>{project.annotation_count ?? 0} annotations</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: '100%',
                            background: pct > 0 ? ACCENT : 'transparent',
                            borderRadius: 4,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT, minWidth: 42, textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) {
              setShowModal(false);
              resetModal();
            }
          }}
        >
          <div
            style={{
              width: 600,
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ padding: '28px 32px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY }}>New Project</div>
              <div style={{ fontSize: 18, color: TEXT_SECONDARY, marginTop: 6 }}>
                Set up your annotation project with images and labels
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Project Name */}
              <div>
                <label style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 8 }}>
                  Project Name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !creating) { setShowModal(false); resetModal(); }
                  }}
                  placeholder="e.g. Street Signs Dataset"
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 12,
                    color: TEXT_PRIMARY,
                    fontSize: 18,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 8 }}>
                  Description <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What will this dataset be used for?"
                  rows={2}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 12,
                    color: TEXT_PRIMARY,
                    fontSize: 18,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
              </div>

              {/* Class Labels */}
              <div>
                <label style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 8 }}>
                  Class Labels <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional, comma-separated)</span>
                </label>
                <input
                  value={newLabels}
                  onChange={(e) => setNewLabels(e.target.value)}
                  placeholder="e.g. cat, dog, car, person"
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: '#ffffff',
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 12,
                    color: TEXT_PRIMARY,
                    fontSize: 18,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
                  onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                />
                {newLabels.trim() && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {newLabels.split(',').map((l) => l.trim()).filter(Boolean).map((label, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 16,
                          padding: '4px 14px',
                          background: ACCENT_BG,
                          color: ACCENT,
                          borderRadius: 16,
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, display: 'block', marginBottom: 8 }}>
                  Images <span style={{ fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
                </label>

                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setImageFiles((prev) => {
                      const existing = new Set(prev.map((f) => f.name + f.size));
                      return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                    });
                    e.target.value = '';
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  webkitdirectory=""
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter((f) =>
                      f.type.startsWith('image/')
                    );
                    setImageFiles((prev) => {
                      const existing = new Set(prev.map((f) => f.name + f.size));
                      return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                    });
                    e.target.value = '';
                  }}
                />

                {imageFiles.length === 0 ? (
                  <div
                    style={{
                      border: `2px dashed ${BORDER}`,
                      borderRadius: 14,
                      padding: '32px 24px',
                      textAlign: 'center',
                      background: '#fafafa',
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter((f) =>
                        f.type.startsWith('image/')
                      );
                      setImageFiles((prev) => {
                        const existing = new Set(prev.map((f) => f.name + f.size));
                        return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                      });
                    }}
                  >
                    <div style={{ fontSize: 18, color: TEXT_SECONDARY, marginBottom: 16 }}>
                      Drop images here, or
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => filesInputRef.current?.click()}
                        style={{
                          padding: '10px 22px',
                          background: '#fff',
                          border: `1.5px solid ${BORDER}`,
                          borderRadius: 10,
                          color: TEXT_PRIMARY,
                          cursor: 'pointer',
                          fontSize: 17,
                          fontWeight: 500,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                      >
                        Select Images
                      </button>
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        style={{
                          padding: '10px 22px',
                          background: '#fff',
                          border: `1.5px solid ${BORDER}`,
                          borderRadius: 10,
                          color: TEXT_PRIMARY,
                          cursor: 'pointer',
                          fontSize: 17,
                          fontWeight: 500,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                      >
                        Select Folder
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: `1.5px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: '18px 22px',
                      background: '#fafafa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>
                        {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected
                      </div>
                      <div style={{ fontSize: 16, color: TEXT_SECONDARY, marginTop: 4 }}>
                        {(imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFiles([])}
                      disabled={creating}
                      style={{
                        padding: '8px 18px',
                        background: 'transparent',
                        border: `1.5px solid ${BORDER}`,
                        borderRadius: 8,
                        color: TEXT_SECONDARY,
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 500,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '18px 32px 28px', borderTop: `1px solid ${BORDER}` }}>
              {creating && uploadStatus && (
                <div style={{ fontSize: 17, color: ACCENT, marginBottom: 14, textAlign: 'center', fontWeight: 500 }}>
                  {uploadStatus}
                </div>
              )}
              <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowModal(false); resetModal(); }}
                  disabled={creating}
                  style={{
                    padding: '14px 28px',
                    background: '#fff',
                    color: TEXT_PRIMARY,
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 12,
                    cursor: creating ? 'default' : 'pointer',
                    fontSize: 18,
                    fontWeight: 500,
                    opacity: creating ? 0.5 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#f8f8f8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  style={{
                    padding: '14px 32px',
                    background: newName.trim() && !creating ? ACCENT : '#e5e5e5',
                    color: newName.trim() && !creating ? '#ffffff' : TEXT_MUTED,
                    border: 'none',
                    borderRadius: 12,
                    cursor: newName.trim() && !creating ? 'pointer' : 'default',
                    fontSize: 18,
                    fontWeight: 600,
                    boxShadow: newName.trim() && !creating ? '0 4px 16px rgba(108, 92, 231, 0.25)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (newName.trim() && !creating) e.currentTarget.style.background = '#5a4bd6'; }}
                  onMouseLeave={(e) => { if (newName.trim() && !creating) e.currentTarget.style.background = ACCENT; }}
                >
                  {creating ? 'Setting up...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
