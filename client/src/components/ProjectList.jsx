import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import * as api from '../api';

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

      // Upload images in batches of 50
      if (imageFiles.length > 0) {
        const BATCH = 50;
        for (let i = 0; i < imageFiles.length; i += BATCH) {
          const batch = imageFiles.slice(i, i + BATCH);
          setUploadStatus(`Uploading images ${i + 1}–${Math.min(i + BATCH, imageFiles.length)} of ${imageFiles.length}...`);
          await api.uploadImages(project.id, batch);
        }
      }

      // Create label classes
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
        background: '#ffffff',
        color: '#1f2937',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
      }}
    >
      {/* Top navbar */}
      <div
        style={{
          height: 48,
          background: '#ffffff',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#f97316" />
            <path d="M6 18L12 6l6 12H6z" fill="white" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>dataTail</span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px 6px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Breadcrumb */}
        <span style={{ fontSize: 14, color: '#1f2937' }}>Home</span>

        <span style={{ flex: 1 }} />

        {/* Right side items */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ fontSize: 13, color: '#1f2937' }}>Light</span>
        </div>

        <div
          style={{
            padding: '2px 8px',
            background: '#fef3c7',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            color: '#92400e',
          }}
        >
          Beta
        </div>

        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          LU
        </div>
      </div>

      {/* Left sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.15)',
              zIndex: 200,
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 190,
              background: '#ffffff',
              borderRight: '1px solid #e8e8e8',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Sidebar header */}
            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
                borderBottom: '1px solid #e8e8e8',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="#f97316" />
                <path d="M6 18L12 6l6 12H6z" fill="white" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', flex: 1 }}>dataTail</span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, padding: '8px 0' }}>
              {[
                {
                  label: 'Home',
                  active: true,
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  ),
                },
                {
                  label: 'Projects',
                  active: false,
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    margin: '1px 6px',
                    borderRadius: 6,
                    background: item.active ? '#f3f4f6' : 'transparent',
                    color: item.active ? '#1f2937' : '#6b7280',
                    cursor: 'pointer',
                    fontWeight: item.active ? 600 : 400,
                    fontSize: 13,
                  }}
                >
                  {item.icon}
                  {item.label}
                </div>
              ))}
            </div>

            {/* Bottom links */}
            <div style={{ padding: '8px 0', borderTop: '1px solid #e8e8e8' }}>
              {['API', 'Docs', 'GitHub'].map((link) => (
                <div
                  key={link}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 14px',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {link}
                </div>
              ))}
              <div style={{ padding: '8px 14px', fontSize: 11, color: '#9ca3af' }}>v1.0.0</div>
            </div>
          </div>
        </>
      )}

      {/* Page body */}
      <div style={{ padding: '28px 24px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Main column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Welcome */}
            <h1 style={{ fontSize: 30, fontWeight: 700, color: '#1f2937', margin: '0 0 4px 0', letterSpacing: -0.3 }}>
              Welcome
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px 0' }}>
              Let's get you started.
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 16px',
                  background: '#ffffff',
                  color: '#4f46e5',
                  border: '1px solid #4f46e5',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                Create Project
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 16px',
                  background: '#ffffff',
                  color: '#4f46e5',
                  border: '1px solid #4f46e5',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#b91c1c',
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            {/* Recent Projects card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: projects.length > 0 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>
                  Recent Projects
                </span>
                <span
                  onClick={() => setShowModal(true)}
                  style={{ fontSize: 13, color: '#4f46e5', cursor: 'pointer', fontWeight: 500 }}
                >
                  New Project
                </span>
              </div>

              {loading && (
                <div style={{ padding: '24px 18px', color: '#9ca3af', fontSize: 13 }}>
                  Loading projects...
                </div>
              )}

              {!loading && projects.length === 0 && (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No projects yet.{' '}
                  <span
                    onClick={() => setShowModal(true)}
                    style={{ color: '#4f46e5', cursor: 'pointer' }}
                  >
                    Create your first project
                  </span>
                </div>
              )}

              {!loading && projects.map((project, idx) => {
                const pct = project.image_count > 0
                  ? Math.round((project.annotation_count / project.image_count) * 100)
                  : 0;
                const isLast = idx === projects.length - 1;
                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/project/${project.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 18px',
                      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Left: name + progress text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {project.annotation_count ?? 0} of {project.image_count ?? 0} Images annotated ({pct}%)
                      </div>
                    </div>

                    {/* Right: progress bar */}
                    <div
                      style={{
                        width: 120,
                        height: 6,
                        background: '#e5e7eb',
                        borderRadius: 3,
                        overflow: 'hidden',
                        flexShrink: 0,
                        marginLeft: 16,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          height: '100%',
                          background: pct > 0 ? '#0d9488' : 'transparent',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>Resources</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Learn, explore and get help
                </div>
              </div>

              {[
                'Documentation',
                'GitHub Repository',
                'Release Notes',
                'Tailscale Setup',
                'MobileSAM Guide',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 18px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#1f2937',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item}
                  <ExternalLinkIcon />
                </div>
              ))}

              <div
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#6b7280',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#f97316" />
                  <path d="M6 18L12 6l6 12H6z" fill="white" />
                </svg>
                dataTail Version: Community
              </div>
            </div>
          </div>
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
            background: 'rgba(0,0,0,0.3)',
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
              width: 500,
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #e8e8e8',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              overflow: 'hidden',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1f2937' }}>New Project</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                Set up your annotation project with images and labels
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Project Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
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
                    padding: '9px 12px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    color: '#1f2937',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Description <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What will this dataset be used for?"
                  rows={2}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    color: '#1f2937',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                />
              </div>

              {/* Class Labels */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Class Labels <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional, comma-separated)</span>
                </label>
                <input
                  value={newLabels}
                  onChange={(e) => setNewLabels(e.target.value)}
                  placeholder="e.g. cat, dog, car, person"
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    color: '#1f2937',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                />
                {/* Label preview chips */}
                {newLabels.trim() && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {newLabels.split(',').map((l) => l.trim()).filter(Boolean).map((label, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: '#eef2ff',
                          color: '#4f46e5',
                          borderRadius: 10,
                          fontWeight: 500,
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
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Images <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </label>

                {/* Hidden file inputs */}
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
                  /* Drop zone */
                  <div
                    style={{
                      border: '1.5px dashed #d1d5db',
                      borderRadius: 8,
                      padding: '20px 16px',
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
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
                      Drop images here, or
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => filesInputRef.current?.click()}
                        style={{
                          padding: '6px 14px',
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          color: '#374151',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        Select Images
                      </button>
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        style={{
                          padding: '6px 14px',
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          color: '#374151',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        Select Folder
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Files selected summary */
                  <div
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      padding: '12px 14px',
                      background: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                        {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {(imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFiles([])}
                      disabled={creating}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        border: '1px solid #e5e7eb',
                        borderRadius: 5,
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #f3f4f6' }}>
              {/* Upload status */}
              {creating && uploadStatus && (
                <div style={{ fontSize: 12, color: '#4f46e5', marginBottom: 10, textAlign: 'center' }}>
                  {uploadStatus}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowModal(false); resetModal(); }}
                  disabled={creating}
                  style={{
                    padding: '8px 16px',
                    background: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: creating ? 'default' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: creating ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  style={{
                    padding: '8px 20px',
                    background: newName.trim() && !creating ? '#4f46e5' : '#e5e7eb',
                    color: newName.trim() && !creating ? '#ffffff' : '#9ca3af',
                    border: 'none',
                    borderRadius: 6,
                    cursor: newName.trim() && !creating ? 'pointer' : 'default',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
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
