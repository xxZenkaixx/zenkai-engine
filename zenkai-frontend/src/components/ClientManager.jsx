// Minimal admin client-management list. Row → detail modal → Delete User
// (two-step confirm). Wireframe: avatar initials, name, meta, role tag.
import { useState, useEffect, useCallback } from 'react';
import { fetchManagedClients, deleteUserFull } from '../api/clientManageApi';
import './ClientManager.css';

const ROLE_TAG = {
  'self-serve': { label: 'SS', cls: 'cm-tag--ss' },
  client:       { label: 'CL', cls: 'cm-tag--cl' },
  admin:        { label: 'PT', cls: 'cm-tag--pt' },
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Selection-aware: when `onSelectClient` is provided, clicking a row delegates
// selection to the parent (used by AdminDashboard's right-detail panel) and
// the modal flow is skipped. When omitted, falls back to the original modal
// behavior so the component still works standalone.
export default function ClientManager(props) {
  const {
    selectedClientId = null,
    onSelectClient = null,
    onClientDeleted = null,
  } = props;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);   // client row open in modal
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagedClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = (c) => { setSelected(c); setConfirming(false); setError(null); };
  const closeDetail = () => { if (!deleting) { setSelected(null); setConfirming(false); } };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteUserFull(selected.id);
      setSelected(null);
      setConfirming(false);
      await load();
      onClientDeleted?.(selected.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="cm-loading">Loading clients...</p>;
  if (error && clients.length === 0) return <p className="cm-error">{error}</p>;

  return (
    <div className="cm-wrap">
      <div className="cm-list-head">
        <span className="cm-list-head__label">All Clients — {clients.length}</span>
      </div>

      {clients.length === 0 ? (
        <p className="cm-empty">No clients yet.</p>
      ) : (
        <div className="cm-list">
          {clients.map((c) => {
            const tag = ROLE_TAG[c.role];
            return (
              <button
                key={c.id}
                className={`cm-row ${c.id === selectedClientId ? 'cm-row--active' : ''}`}
                onClick={() => {
                  if (onSelectClient) onSelectClient(c.id);
                  else openDetail(c);
                }}
              >
                <span className="cm-avatar">{initials(c.name)}</span>
                <span className="cm-row__info">
                  <span className="cm-row__name">{c.name}</span>
                  <span className="cm-row__meta">
                    {c.email || 'no login'}
                    {c.activeProgram ? ` · ${c.activeProgram.name}` : ' · no program'}
                  </span>
                </span>
                {tag && <span className={`cm-tag ${tag.cls}`}>{tag.label}</span>}
                <span className="cm-row__chev">›</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="cm-modal-backdrop" onClick={closeDetail}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="cm-modal__head">
              <span className="cm-avatar cm-avatar--lg">{initials(selected.name)}</span>
              <div className="cm-modal__title">
                <h3 className="cm-modal__name">{selected.name}</h3>
                {ROLE_TAG[selected.role] && (
                  <span className={`cm-tag ${ROLE_TAG[selected.role].cls}`}>
                    {ROLE_TAG[selected.role].label}
                  </span>
                )}
              </div>
              <button className="cm-modal__close" onClick={closeDetail} disabled={deleting}>×</button>
            </div>

            <dl className="cm-detail">
              <div className="cm-detail__row"><dt>Email</dt><dd>{selected.email || '—'}</dd></div>
              <div className="cm-detail__row"><dt>Role</dt><dd>{selected.role || '—'}</dd></div>
              <div className="cm-detail__row">
                <dt>Active Program</dt>
                <dd>{selected.activeProgram ? `${selected.activeProgram.name} · ${selected.activeProgram.weeks}w` : '—'}</dd>
              </div>
              <div className="cm-detail__row"><dt>Login</dt><dd>{selected.user_id ? 'Yes' : 'No account'}</dd></div>
            </dl>

            {error && <p className="cm-error">{error}</p>}

            <div className="cm-modal__actions">
              {!confirming ? (
                <button className="cm-btn cm-btn--danger" onClick={() => setConfirming(true)}>
                  Delete User
                </button>
              ) : (
                <div className="cm-confirm">
                  <p className="cm-confirm__text">
                    Permanently delete <strong>{selected.name}</strong>
                    {selected.user_id ? ' and their login' : ''}, plus all workout history
                    and progression? This cannot be undone.
                  </p>
                  <div className="cm-confirm__btns">
                    <button className="cm-btn" onClick={() => setConfirming(false)} disabled={deleting}>
                      Cancel
                    </button>
                    <button className="cm-btn cm-btn--danger" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
