// * Renders the program list with create, clone, edit, delete, and selection.
// * Keeps selected program local and clears it safely on delete.

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createProgram, updateProgram, deleteProgram, cloneProgram } from '../api/programApi';
import { assignProgram, fetchActiveProgram } from '../api/clientProgramApi';
import ProgramDayList from './ProgramDayList';
import WorkoutPreview from './WorkoutPreview';
import ClientTargetEditor from './ClientTargetEditor';
import ClientMaxEditor from './ClientMaxEditor';

// The fixed mesocycle length for a periodized program. Must match
// MESOCYCLE_WEEKS in zenkai-backend/services/periodizationService.js. A
// mismatch fails loudly — the server rejects a periodized program of any other
// length with a 400 — rather than silently producing a program whose later
// weeks are unreachable.
const PERIODIZED_WEEKS = 16;

// Create is a sequence, not a form: name, then periodized or not, then only
// the fields that choice implies. Steps are named rather than numbered so the
// render branches read as what they show.
const CREATE_STEPS = ['name', 'type', 'details'];
const STEP_LABEL = { name: 'Name', type: 'Type', details: 'Details' };

export default function ProgramList({ programs, clients = [], onProgramsChanged, onAssigned, onOpenBuilder, activeProgramId, clientId, onActivated }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('');
  const [deloadWeeks, setDeloadWeeks] = useState('');
  const [periodized, setPeriodized] = useState(false);
  // null = collapsed. The create form does not exist until the user starts it,
  // which is what makes "+ New Program" an entry point rather than a submit.
  const [createStep, setCreateStep] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [previewProgramId, setPreviewProgramId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ name: '', weeks: '', deload_weeks: '', is_template: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [activateError, setActivateError] = useState(null);
  const [cloningId, setCloningId] = useState(null);

  // Self-serve only sees programs they own here. Templates surface in the
  // dedicated Templates section (ClientDashboard). Admins see everything.
  const visiblePrograms = isAdmin ? programs : programs.filter(p => !p.is_template);

  const [launchClientId, setLaunchClientId] = useState('');
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [launchedClientProgramId, setLaunchedClientProgramId] = useState(null);

  // Resolve an EXISTING assignment when a client is picked, not just after a
  // fresh launch. Without this, launchedClientProgramId is only ever set by
  // handleLaunch, so both editors below are reachable for a few seconds after
  // launching and never again for an already-assigned client.
  useEffect(() => {
    if (!launchClientId || !selectedProgramId) {
      setLaunchedClientProgramId(null);
      return;
    }
    let cancelled = false;
    fetchActiveProgram(launchClientId)
      .then((assignment) => {
        if (cancelled) return;
        setLaunchedClientProgramId(
          assignment?.program_id === selectedProgramId ? assignment.id : null
        );
      })
      .catch(() => { if (!cancelled) setLaunchedClientProgramId(null); });
    return () => { cancelled = true; };
  }, [launchClientId, selectedProgramId]);

  const parseDeloadWeeks = (value) => {
    if (!value.trim()) return [];
    return value
      .split(',')
      .map((w) => Number(w.trim()))
      .filter((w) => Number.isInteger(w) && w > 0);
  };

  // Collapses the flow and clears every field. Periodization is irreversible,
  // so silently inheriting it on the next program is the worst available
  // failure — this reset is not optional.
  const resetCreateForm = () => {
    setCreateStep(null);
    setName('');
    setWeeks('');
    setDeloadWeeks('');
    setPeriodized(false);
    setError(null);
  };

  // A periodized program's length is a constant, never editable state. That is
  // the whole reason 16 can no longer appear in the weeks field before the
  // user has decided anything, and why it cannot survive a switch back to
  // standard.
  const createWeeks = periodized ? PERIODIZED_WEEKS : Number(weeks);
  const canCreate = Number.isInteger(createWeeks) && createWeeks > 0;

  const handleCreate = async () => {
    const parsedWeeks = createWeeks;
    if (!name.trim() || !Number.isInteger(parsedWeeks) || parsedWeeks <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createProgram({
        name: name.trim(),
        weeks: parsedWeeks,
        deload_weeks: parseDeloadWeeks(deloadWeeks),
        // Conditional on purpose: a non-periodized create must send a body
        // byte-identical to what it sent before this option existed.
        ...(periodized ? { periodized: true } : {})
      });
      resetCreateForm();
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

  // Deep-copies the program (days + exercise instances) into a new program owned
  // by the caller with is_template = false, so the original is never touched.
  // Selects the copy and opens the inline edit form on it — renaming the copy is
  // almost always the first thing you want to do.
  const handleClone = async (program) => {
    setCloningId(program.id);
    setError(null);
    try {
      const copy = await cloneProgram(program.id);
      if (onProgramsChanged) await onProgramsChanged();
      setSelectedProgramId(copy.id);
      setLaunchedClientProgramId(null);
      setLaunchSuccess(false);
      handleEditStart(copy);
    } catch (err) {
      setError(err.message);
    } finally {
      setCloningId(null);
    }
  };

  const handleActivate = async (programId) => {
    if (!clientId) return;
    setActivatingId(programId);
    setActivateError(null);
    try {
      await assignProgram({
        client_id: clientId,
        program_id: programId,
        start_date: new Date().toISOString().split('T')[0]
      });
      if (onActivated) await onActivated();
    } catch (err) {
      setActivateError(err.message);
    } finally {
      setActivatingId(null);
    }
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

        {createStep === null ? (
          <button className="prog-create-btn" onClick={() => setCreateStep('name')}>
            + New Program
          </button>
        ) : (
          <div className="prog-create-form">
            <p className="prog-create-form__step">
              Step {CREATE_STEPS.indexOf(createStep) + 1} of {CREATE_STEPS.length} · {STEP_LABEL[createStep]}
            </p>

            {/* Decisions already made stay on screen. Without this the later
                steps are context-free and the name is unverifiable. */}
            {createStep !== 'name' && (
              <p className="prog-create-form__summary">
                {name.trim()}
                {createStep === 'details' && (
                  <span> · {periodized ? 'Periodized' : 'Standard'}</span>
                )}
              </p>
            )}

            {createStep === 'name' && (
              <>
                <input
                  className="prog-input"
                  placeholder="Program name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="prog-create-form__actions">
                  <button
                    className="prog-create-btn"
                    disabled={!name.trim()}
                    onClick={() => setCreateStep('type')}
                  >
                    Continue
                  </button>
                  <button className="prog-btn" onClick={resetCreateForm}>Cancel</button>
                </div>
              </>
            )}

            {createStep === 'type' && (
              <>
                <button
                  className="prog-create-option"
                  onClick={() => { setPeriodized(true); setCreateStep('details'); }}
                >
                  <span className="prog-create-option__title">Periodized</span>
                  <span className="prog-create-option__sub">
                    Fixed {PERIODIZED_WEEKS}-week mesocycle
                  </span>
                </button>
                <button
                  className="prog-create-option"
                  onClick={() => { setPeriodized(false); setCreateStep('details'); }}
                >
                  <span className="prog-create-option__title">Standard</span>
                  <span className="prog-create-option__sub">You choose the length</span>
                </button>
                <div className="prog-create-form__actions">
                  <button className="prog-btn" onClick={() => setCreateStep('name')}>Back</button>
                  <button className="prog-btn" onClick={resetCreateForm}>Cancel</button>
                </div>
              </>
            )}

            {createStep === 'details' && (
              <>
                {periodized ? (
                  <>
                    <p className="prog-create-form__locked">{PERIODIZED_WEEKS} weeks · fixed</p>
                    <p className="prog-create-form__hint">
                      Fixed {PERIODIZED_WEEKS}-week mesocycle. Every client starts at week 1.
                      This cannot be changed after the program is created.
                    </p>
                  </>
                ) : (
                  <input
                    className="prog-input"
                    placeholder="Weeks"
                    type="number"
                    value={weeks}
                    autoFocus
                    onChange={(e) => setWeeks(e.target.value)}
                  />
                )}
                <input
                  className="prog-input"
                  placeholder="Deload weeks e.g. 4,8,12"
                  value={deloadWeeks}
                  onChange={(e) => setDeloadWeeks(e.target.value)}
                />
                <div className="prog-create-form__actions">
                  <button
                    className="prog-create-btn"
                    onClick={handleCreate}
                    disabled={loading || !canCreate}
                  >
                    {loading ? 'Creating...' : 'Create Program'}
                  </button>
                  <button
                    className="prog-btn"
                    onClick={() => setCreateStep('type')}
                    disabled={loading}
                  >
                    Back
                  </button>
                </div>
              </>
            )}

            {error && <p className="prog-error">{error}</p>}
          </div>
        )}

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
                    <button
                      className="prog-btn"
                      style={{
                        background: activeProgramId === p.id ? '#c8ff00' : '#2a2a2a',
                        color: activeProgramId === p.id ? '#0a0a0a' : '#888',
                        borderColor: activeProgramId === p.id ? '#c8ff00' : '#2a2a2a',
                        fontWeight: 600,
                        cursor: activeProgramId === p.id ? 'default' : 'pointer'
                      }}
                      disabled={activatingId === p.id || !clientId || activeProgramId === p.id}
                      onClick={() => handleActivate(p.id)}
                    >
                      {activatingId === p.id ? '...' : activeProgramId === p.id ? 'Active' : 'Activate'}
                    </button>
                    <button className="prog-btn" onClick={() => handleEditStart(p)}>Edit</button>
                    <button
                      className="prog-btn"
                      disabled={cloningId === p.id}
                      onClick={() => handleClone(p)}
                    >
                      {cloningId === p.id ? '...' : 'Clone'}
                    </button>
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
        {activateError && <p className="prog-error">{activateError}</p>}
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
              <>
                <ClientTargetEditor clientProgramId={launchedClientProgramId} />
                <ClientMaxEditor clientProgramId={launchedClientProgramId} />
              </>
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
