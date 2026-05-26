// * Renders the program list with create, edit, delete, and selection.
// * Keeps selected program local and clears it safely on delete.

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createProgram, updateProgram, deleteProgram } from '../api/programApi';
import { assignProgram } from '../api/clientProgramApi';
import ProgramDayList from './ProgramDayList';
import WorkoutPreview from './WorkoutPreview';
import ClientTargetEditor from './ClientTargetEditor';

export default function ProgramList({ programs, clients = [], onProgramsChanged, onAssigned, onOpenBuilder }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('');
  const [deloadWeeks, setDeloadWeeks] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [previewProgramId, setPreviewProgramId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ name: '', weeks: '', deload_weeks: '', is_template: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Self-serve only sees programs they own here. Templates surface in the
  // dedicated Templates section (ClientDashboard). Admins see everything.
  const visiblePrograms = isAdmin ? programs : programs.filter(p => !p.is_template);

  const [launchClientId, setLaunchClientId] = useState('');
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [launchedClientProgramId, setLaunchedClientProgramId] = useState(null);

  const parseDeloadWeeks = (value) => {
    if (!value.trim()) return [];
    return value
      .split(',')
      .map((w) => Number(w.trim()))
      .filter((w) => Number.isInteger(w) && w > 0);
  };

  const handleCreate = async () => {
    const parsedWeeks = Number(weeks);
    if (!name.trim() || !Number.isInteger(parsedWeeks) || parsedWeeks <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createProgram({
        name: name.trim(),
        weeks: parsedWeeks,
        deload_weeks: parseDeloadWeeks(deloadWeeks)
      });
      setName('');
      setWeeks('');
      setDeloadWeeks('');
      if (onProgramsChanged) await onProgramsChanged();
      if (onOpenBuilder) onOpenBuilder(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await deleteProgram(id);
      if (selectedProgramId === id) {
        setSelectedProgramId(null);
        setLaunchedClientProgramId(null);
        setLaunchSuccess(false);
      }
      if (editingId === id) setEditingId(null);
      if (onProgramsChanged) await onProgramsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditStart = (program) => {
    setError(null);
    setEditingId(program.id);
    setEditFields({
      name: program.name || '',
      weeks: String(program.weeks || ''),
      deload_weeks: (program.deload_weeks || []).join(','),
      is_template: !!program.is_template
    });
  };

  const handleLaunch = async () => {
    if (!launchClientId) {
      setLaunchError('Select a client.');
      return;
    }
    setLaunchLoading(true);
    setLaunchError(null);
    setLaunchSuccess(false);
    setLaunchedClientProgramId(null);
    try {
      const result = await assignProgram({
        client_id: launchClientId,
        program_id: selectedProgramId,
        start_date: new Date().toISOString().split('T')[0]
      });
      setLaunchedClientProgramId(result.id);
      setLaunchSuccess(true);
      setLaunchClientId('');
      if (onAssigned) await onAssigned();
    } catch (err) {
      setLaunchError(err.message);
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleEditSave = async (id) => {
    const parsedWeeks = Number(editFields.weeks);
    if (!editFields.name.trim() || !Number.isInteger(parsedWeeks) || parsedWeeks <= 0) return;
    setError(null);
    try {
      const payload = {
        name: editFields.name.trim(),
        weeks: parsedWeeks,
        deload_weeks: parseDeloadWeeks(editFields.deload_weeks)
      };
      // Backend strips is_template from non-admin bodies, but don't even send
      // it from the client unless we know the user can flip it.
      if (isAdmin) payload.is_template = !!editFields.is_template;
      await updateProgram(id, payload);
      setEditingId(null);
      if (onProgramsChanged) await onProgramsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="prog-workspace">

      {/* ── Left: create form + program list ── */}
      <div className="prog-sidebar">
        <div className="prog-sidebar__header">
          <span className="prog-sidebar__title">All Programs</span>
        </div>

        <div className="prog-create-form">
          <input
            className="prog-input"
            placeholder="Program name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="prog-input"
            placeholder="Weeks"
            type="number"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
          />
          <input
            className="prog-input"
            placeholder="Deload weeks e.g. 4,8,12"
            value={deloadWeeks}
            onChange={(e) => setDeloadWeeks(e.target.value)}
          />
          <button className="prog-create-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : '+ New Program'}
          </button>
          {error && <p className="prog-error">{error}</p>}
        </div>

        <ul className="prog-list">
          {visiblePrograms.map((p) => (
            <li
              key={p.id}
              className={`prog-list__item${selectedProgramId === p.id ? ' prog-list__item--active' : ''}`}
              onClick={() => {
                if (editingId !== p.id) {
                  setSelectedProgramId(p.id);
                  setLaunchedClientProgramId(null);
                  setLaunchSuccess(false);
                }
              }}
            >
              {editingId === p.id ? (
                <div className="prog-list__edit-form">
                  <input
                    className="prog-input"
                    value={editFields.name}
                    onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                  />
                  <input
                    className="prog-input"
                    type="number"
                    value={editFields.weeks}
                    onChange={(e) => setEditFields({ ...editFields, weeks: e.target.value })}
                  />
                  <input
                    className="prog-input"
                    placeholder="Deload weeks"
                    value={editFields.deload_weeks}
                    onChange={(e) => setEditFields({ ...editFields, deload_weeks: e.target.value })}
                  />
                  {isAdmin && (
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#aaa', fontSize: 12, marginTop: 4, cursor: 'pointer' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={editFields.is_template}
                        onChange={(e) => setEditFields({ ...editFields, is_template: e.target.checked })}
                      />
                      Make available to Self-Serve (Template)
                    </label>
                  )}
                  <div className="prog-list__edit-actions">
                    <button
                      className="prog-btn prog-btn--save"
                      onClick={(e) => { e.stopPropagation(); handleEditSave(p.id); }}
                    >Save</button>
                    <button
                      className="prog-btn"
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="prog-list__item-inner">
                  <div className="prog-list__item-info">
                    <span className="prog-list__item-name">
                      {p.name}
                      {p.is_template && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: '#c8ff00', border: '1px solid #2a3a00', padding: '1px 6px', borderRadius: 6, letterSpacing: '0.08em', verticalAlign: 'middle' }}>TEMPLATE</span>
                      )}
                    </span>
                    <span className="prog-list__item-meta">
                      {p.weeks} weeks{p.deload_weeks?.length ? ` · deload: ${p.deload_weeks.join(', ')}` : ''}
                    </span>
                  </div>
                  <div className="prog-list__item-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="prog-btn" onClick={() => handleEditStart(p)}>Edit</button>
                    <button className="prog-btn prog-btn--danger" onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {visiblePrograms.length === 0 && (
            <li className="prog-list__empty">No programs yet.</li>
          )}
        </ul>
      </div>

      {/* ── Right: detail panel ── */}
      <div className="prog-detail">
        {!selectedProgramId ? (
          <div className="prog-detail__empty">
            <p className="prog-detail__empty-title">No program selected</p>
            <p className="prog-detail__empty-sub">Choose a program on the left to build its days and exercises.</p>
          </div>
        ) : (
          <div>
            <div className="prog-detail__header">
              <div>
                <h3 className="prog-detail__title">
                  {programs.find(p => p.id === selectedProgramId)?.name}
                </h3>
                <span className="prog-detail__meta">
                  {programs.find(p => p.id === selectedProgramId)?.weeks} weeks
                </span>
              </div>
              <button
                className="prog-btn"
                onClick={() => setPreviewProgramId(previewProgramId === selectedProgramId ? null : selectedProgramId)}
              >
                {previewProgramId === selectedProgramId ? 'Close Preview' : 'Preview'}
              </button>
              <button
                className="prog-btn prog-btn--primary"
                onClick={() => onOpenBuilder && onOpenBuilder(programs.find(p => p.id === selectedProgramId))}
              >
                Open Builder
              </button>
            </div>

            <div className="prog-launch-panel">
              <p className="prog-launch-panel__label">Launch This Program</p>
              <div className="prog-launch-panel__fields">
                <div className="prog-launch-field">
                  <label className="prog-launch-field__label">Client</label>
                  <select
                    className="prog-input prog-launch-select"
                    value={launchClientId}
                    onChange={(e) => {
                      setLaunchClientId(e.target.value);
                      setLaunchSuccess(false);
                      setLaunchError(null);
                    }}
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="prog-launch-btn"
                  onClick={handleLaunch}
                  disabled={launchLoading || !launchClientId}
                >
                  {launchLoading ? 'Launching...' : 'Launch Program'}
                </button>
              </div>
              {launchError && <p className="prog-launch-error">{launchError}</p>}
              {launchSuccess && (
                <p className="prog-launch-success">Launched. Set starting weights below.</p>
              )}
            </div>

            {launchedClientProgramId && (
              <ClientTargetEditor clientProgramId={launchedClientProgramId} />
            )}

            {previewProgramId === selectedProgramId && (
              <WorkoutPreview programId={selectedProgramId} />
            )}

            <ProgramDayList programId={selectedProgramId} />
          </div>
        )}
      </div>

    </div>
  );
}
