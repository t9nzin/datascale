import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import * as api from '../api';

const ACCENT = '#6C5CE7';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#888';
const BORDER = '#e8e8e8';
const BG = '#f4f5f7';

const USER_COLORS = [
  '#6C5CE7', '#00b894', '#e17055', '#0984e3', '#fdcb6e',
  '#e84393', '#00cec9', '#d63031',
];

function getUserColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function getUserInitials(login) {
  if (!login || login === 'local-user') return 'LU';
  const local = login.split('@')[0];
  const parts = local.split(/[._-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function sourceLabel(source) {
  const map = {
    'manual': 'Manual',
    'sam-click': 'SAM Click',
    'sam-box': 'SAM Box',
    'sam-auto': 'SAM Auto',
    'nl-agent': 'NL Agent',
    'ai-segment': 'AI Segment',
  };
  return map[source] || source;
}

// ── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function AnnotateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ProjectHub() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const connectedUsers = useStore((s) => s.connectedUsers);
  const currentUser = useStore((s) => s.currentUser);

  // Connect to WebSocket for presence
  useWebSocket();

  const [project, setProject] = useState(null);
  const [activity, setActivity] = useState(null);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [proj, act, lbl] = await Promise.all([
          api.fetchProject(projectId),
          api.fetchProjectActivity(projectId),
          api.fetchLabels(projectId),
        ]);
        setProject(proj);
        setActivity(act);
        setLabels(lbl);
      } catch (err) {
        console.error('Failed to load project hub:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading || !project) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: TEXT_SECONDARY, fontSize: 14,
      }}>
        Loading project...
      </div>
    );
  }

  const pct = project.image_count > 0
    ? Math.round(((project.done_count ?? 0) / project.image_count) * 100)
    : 0;

  const onlineHere = connectedUsers.filter(u => u !== currentUser);

  return (
    <div style={{
      width: '100vw', height: '100vh', background: BG, overflow: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: `1px solid ${BORDER}`,
        padding: '0 48px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: TEXT_SECONDARY, fontSize: 13, padding: '6px 0',
          }}
        >
          <BackIcon />
          Projects
        </button>
        <div style={{ width: 1, height: 24, background: BORDER, margin: '0 8px' }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
          {project.name}
        </h1>
        {project.created_by && project.created_by !== 'local-user' && (
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            by {project.created_by}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Online presence */}
        {onlineHere.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4aff4a' }} />
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
              {onlineHere.length} online
            </span>
            <div style={{ display: 'flex', marginLeft: 4 }}>
              {onlineHere.slice(0, 5).map((u, i) => (
                <div key={u} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: getUserColor(u),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff',
                  border: '2px solid #fff',
                  marginLeft: i > 0 ? -8 : 0,
                }} title={u}>
                  {getUserInitials(u)}
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => navigate(`/project/${projectId}/annotate`)}
          style={{
            background: '#1a1a2e', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 24px', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2d2d4e'}
          onMouseLeave={e => e.currentTarget.style.background = '#1a1a2e'}
        >
          <AnnotateIcon />
          Open Annotation Editor
        </button>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 48px 60px' }}>
        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="Images" value={project.image_count ?? 0} color={ACCENT} />
          <StatCard label="Annotations" value={project.annotation_count ?? 0} color="#27ae60" />
          <StatCard label="Labels" value={labels.length} color="#e67e22" />
          <StatCard label="Completion" value={`${pct}%`} color={pct === 100 ? '#27ae60' : '#0984e3'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Contributors */}
            <Card title="Contributors">
              {activity?.contributors?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activity.contributors.map((c) => (
                    <div key={c.created_by} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: getUserColor(c.created_by),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {getUserInitials(c.created_by)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                          {c.created_by}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                          {c.annotation_count} annotations
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                        {formatTimeAgo(c.last_active)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>No annotations yet</div>
              )}
            </Card>

            {/* Label Distribution */}
            <Card title="Label Distribution">
              {activity?.labelDistribution?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activity.labelDistribution.map((l) => {
                    const labelClass = labels.find(lc => lc.name === l.label);
                    const total = activity.labelDistribution.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((l.count / total) * 100) : 0;
                    return (
                      <div key={l.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              width: 10, height: 10, borderRadius: 2,
                              background: labelClass?.color || ACCENT,
                              display: 'inline-block',
                            }} />
                            {l.label}
                          </span>
                          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{l.count}</span>
                        </div>
                        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: labelClass?.color || ACCENT,
                            borderRadius: 2, transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>No labels assigned yet</div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card title="Quick Actions">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ActionButton
                  icon={<AnnotateIcon />}
                  label="Open Annotation Editor"
                  onClick={() => navigate(`/project/${projectId}/annotate`)}
                />
                <ActionButton
                  icon={<ExportIcon />}
                  label="Export Dataset"
                  onClick={() => navigate(`/project/${projectId}/annotate`)}
                  subtle
                />
                <ActionButton
                  icon={<ReviewIcon />}
                  label="Quality Review"
                  onClick={() => navigate(`/project/${projectId}/annotate`)}
                  subtle
                />
                <ActionButton
                  icon={<HealthIcon />}
                  label="Dataset Health Check"
                  onClick={() => navigate(`/project/${projectId}/annotate`)}
                  subtle
                />
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Recent Activity */}
            <Card title="Recent Activity">
              {activity?.recentActivity?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activity.recentActivity.map((a, i) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
                      borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: getUserColor(a.created_by),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
                        marginTop: 2,
                      }}>
                        {getUserInitials(a.created_by)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: TEXT_PRIMARY }}>
                          <strong>{a.created_by}</strong>
                          {' annotated '}
                          <span style={{ color: ACCENT, fontWeight: 500 }}>{a.label || 'unlabeled'}</span>
                          {' on '}
                          <span style={{ color: TEXT_SECONDARY }}>{a.image_name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2, display: 'flex', gap: 8 }}>
                          <span>{formatTimeAgo(a.created_at)}</span>
                          <span style={{
                            background: `${ACCENT}15`, color: ACCENT,
                            padding: '0 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                          }}>
                            {sourceLabel(a.source)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>No activity yet. Start annotating!</div>
              )}
            </Card>

            {/* Project Info */}
            <Card title="Project Info">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {project.description && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Description</div>
                    <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>{project.description}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Created</div>
                    <div style={{ fontSize: 13, color: TEXT_PRIMARY }}>{new Date(project.created_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Last Updated</div>
                    <div style={{ fontSize: 13, color: TEXT_PRIMARY }}>{formatTimeAgo(project.updated_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Created By</div>
                    <div style={{ fontSize: 13, color: TEXT_PRIMARY }}>{project.created_by || 'local-user'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Contributors</div>
                    <div style={{ fontSize: 13, color: TEXT_PRIMARY }}>{activity?.contributors?.length ?? 0}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Image Uploads by User */}
            {activity?.uploaders?.length > 0 && (
              <Card title="Uploads by User">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activity.uploaders.map((u) => (
                    <div key={u.uploaded_by} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: getUserColor(u.uploaded_by),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {getUserInitials(u.uploaded_by)}
                      </div>
                      <div style={{ fontSize: 13, color: TEXT_PRIMARY, flex: 1 }}>{u.uploaded_by}</div>
                      <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 600 }}>
                        {u.image_count} images
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
        marginBottom: 16, paddingBottom: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ActionButton({ icon, label, onClick, subtle }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10, border: 'none',
        background: subtle ? '#f8f8fa' : '#1a1a2e',
        color: subtle ? TEXT_PRIMARY : '#fff',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s',
        width: '100%',
      }}
      onMouseEnter={e => e.currentTarget.style.background = subtle ? '#f0f0f4' : '#2d2d4e'}
      onMouseLeave={e => e.currentTarget.style.background = subtle ? '#f8f8fa' : '#1a1a2e'}
    >
      {icon}
      {label}
    </button>
  );
}
