// * Top-level admin view. Owns clients, programs, selectedClientId, and activeProgram state.
// * Keeps program builder independent from client selection.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchClients, fetchUnassignedClients, claimClient, updateClient } from '../api/clientApi';
import { deleteUserFull } from '../api/clientManageApi';
import { fetchPrograms } from '../api/programApi';
import { fetchActiveProgram, deactivateProgram, fetchAssignmentHistory, activateProgram } from '../api/clientProgramApi';
import AdminLayout from './AdminLayout';
import ClientList from './ClientList';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import ProgramList from './ProgramList';
import ProgramBuilder from './ProgramBuilder';
import ClientProgramAssignment from './ClientProgramAssignment';
import AdminVideoUpload from './AdminVideoUpload';
import ExerciseLibrary from './ExerciseLibrary';
import ClientManager from './ClientManager';

function AddClientInline({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await (await import('../api/clientApi')).createClient({ name: name.trim() });
      setName('');
      setOpen(false);
      if (onCreated) onCreated();
    } catch {}
    finally { setLoading(false); }
  };

  if (!open) return (
    <button className="admin-action-btn" onClick={() => setOpen(true)}>+ Add Client</button>
  );

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        autoFocus
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 10px', color: '#e0e0e0', fontSize: 13 }}
        placeholder="Client name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setOpen(false); }}
      />
      <button className="admin-action-btn admin-action-btn--primary" onClick={handleCreate} disabled={loading || !name.trim()}>
        {loading ? '...' : 'Add'}
      </button>
      <button className="admin-action-btn" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

export default function AdminDashboard({ onStartWorkout, onViewClientHome }) {
  const { user } = useAuth();

  const [adminSection, setAdminSection] = useState(() => {
    const saved = localStorage.getItem('adminSection');
    if (
      saved === 'dashboard' ||
      saved === 'programs' ||
      saved === 'programBuilder' ||
      saved === 'clientPortal' ||
      saved === 'exerciseLibrary' ||
      saved === 'videos'
    ) return saved;
    return 'dashboard';
  });
  const [builderProgram, setBuilderProgram] = useState(null);
  const builderRestoreAttempted = useRef(false);

  useEffect(() => {
    localStorage.setItem('adminSection', adminSection);
  }, [adminSection]);

  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [activeProgram, setActiveProgram] = useState(null);
  const [activeProgramLoading, setActiveProgramLoading] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState([]);

  const [renameEditing, setRenameEditing] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unassignedClients, setUnassignedClients] = useState([]);

  useEffect(() => {
    if (builderRestoreAttempted.current) return;
    if (!programs.length) return;

    builderRestoreAttempted.current = true;

    const get = (k) => localStorage.getItem(k);
    const storedSection = get('adminSection');
    if (storedSection !== 'programBuilder') return;

    const storedId = get('builderProgramId');
    if (!storedId) {
      setAdminSection('programs');
      return;
    }

    const found = programs.find((p) => p.id === storedId);

    if (found) {
      setBuilderProgram(found);
      setAdminSection('programBuilder');
    } else {
      setAdminSection('programs');
    }
  }, [programs]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientData, programData, unassignedData] = await Promise.all([
          fetchClients(),
          fetchPrograms(),
          fetchUnassignedClients()
        ]);
        setClients(clientData);
        setPrograms(programData);
        setUnassignedClients(unassignedData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setActiveProgram(null);
      setAssignmentHistory([]);
      return;
    }
    const load = async () => {
      setActiveProgramLoading(true);
      try {
        const [programData, historyData] = await Promise.all([
          fetchActiveProgram(selectedClientId),
          fetchAssignmentHistory(selectedClientId)
        ]);
        setActiveProgram(programData || null);
        setAssignmentHistory(Array.isArray(historyData) ? historyData : []);
      } catch {
        setActiveProgram(null);
        setAssignmentHistory([]);
      } finally {
        setActiveProgramLoading(false);
      }
    };
    load();
  }, [selectedClientId]);

  useEffect(() => {
    setRenameEditing(false);
    setRenameError('');
  }, [selectedClientId]);

  const handleClientCreated = async () => {
    const data = await fetchClients();
    setClients(data);
  };

  const handleClientDeleted = async () => {
    const data = await fetchClients();
    setClients(data);
    setSelectedClientId(null);
    setActiveProgram(null);
  };

  const handleClaimClient = async (clientId) => {
    try {
      await claimClient(clientId);
      setUnassignedClients(prev => prev.filter(c => c.id !== clientId));
      const data = await fetchClients();
      setClients(data);
    } catch (err) {
      setError(err.message || 'Failed to claim client');
    }
  };

  const handleProgramsChanged = async () => {
    const data = await fetchPrograms();
    setPrograms(data);
  };

  const handleAssigned = async () => {
    await handleProgramsChanged();
    if (selectedClientId) {
      const [programData, historyData] = await Promise.all([
        fetchActiveProgram(selectedClientId),
        fetchAssignmentHistory(selectedClientId)
      ]);
      setActiveProgram(programData || null);
      setAssignmentHistory(Array.isArray(historyData) ? historyData : []);
    }
  };

  const handleDeactivateProgram = async (clientId) => {
    try {
      await deactivateProgram(clientId);
      setActiveProgram(null);
    } catch {}
  };

  const handleActivateProgram = async (assignmentId) => {
    try {
      await activateProgram(assignmentId);
      const [programData, historyData] = await Promise.all([
        fetchActiveProgram(selectedClientId),
        fetchAssignmentHistory(selectedClientId)
      ]);
      setActiveProgram(programData || null);
      setAssignmentHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error('Failed to activate program:', err);
    }
  };

  const handleOpenBuilder = (program) => {
    setBuilderProgram(program);
    setAdminSection('programBuilder');
    localStorage.setItem('builderProgramId', program.id);
  };

  const handleBuilderBack = () => {
    setAdminSection('programs');
  };

  if (user?.role !== 'admin') return null;

  const navSection = adminSection === 'programBuilder' ? 'programs' : adminSection;

  if (loading) {
    return (
      <AdminLayout activeSection={navSection} onSectionChange={setAdminSection}>
        <p style={{ color: '#888' }}>Loading...</p>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout activeSection={navSection} onSectionChange={setAdminSection}>
        <p style={{ color: '#ff4444' }}>Error: {error}</p>
      </AdminLayout>
    );
  }

  // * Derived from loaded clients array — safe, no extra fetch
  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const handleRenameStart = () => {
    setRenameValue(selectedClient?.name || '');
    setRenameEditing(true);
    setRenameError('');
  };

  const handleRenameSave = async () => {
    const v = renameValue.trim();
    if (!v || !selectedClientId) return;
    try {
      await updateClient(selectedClientId, { name: v });
      const data = await fetchClients();
      setClients(data);
      setRenameEditing(false);
      setRenameError('');
    } catch (err) {
      setRenameError(err.message || 'Failed to rename');
    }
  };

  const handleDeleteUserFull = async () => {
    if (!selectedClientId) return;
    if (!window.confirm(`Permanently delete ${selectedClient?.name} and all their data? This cannot be undone.`)) return;
    try {
      await deleteUserFull(selectedClientId);
      await handleClientDeleted();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // * Client detail block — shared between Dashboard and Clients sections
  const clientDetail = selectedClientId && (
    <div className="cl-client-detail">
      <div className="rename-header">
        {renameEditing ? (
          <div className="rename-controls">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setRenameEditing(false); }}
            />
            <button className="btn-primary" onClick={handleRenameSave}>Save</button>
            <button className="btn-ghost" onClick={() => setRenameEditing(false)}>Cancel</button>
            {renameError && <span className="rename-error">{renameError}</span>}
          </div>
        ) : (
          <div className="rename-display">
            <h3>{selectedClient?.name}</h3>
            <button className="btn-ghost" onClick={handleRenameStart}>Edit</button>
          </div>
        )}
      </div>

      <h3 style={{ color: '#aaa', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '24px 0 12px' }}>
        Active Program
      </h3>

      {activeProgramLoading && <p style={{ color: '#666' }}>Loading...</p>}

      {!activeProgramLoading && activeProgram?.Program && (
        <p style={{ color: '#e0e0e0', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            <strong>{activeProgram.Program.name}</strong>
            <span style={{ color: '#555', marginLeft: 8 }}>{activeProgram.Program.weeks} weeks</span>
          </span>
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '2px 10px' }} onClick={() => handleDeactivateProgram(selectedClientId)}>
            Remove
          </button>
        </p>
      )}

      {!activeProgramLoading && !activeProgram && (
        <p style={{ color: '#555', margin: '0 0 12px' }}>No active program assigned.</p>
      )}

      <ClientProgramAssignment
        selectedClientId={selectedClientId}
        programs={programs}
        onAssigned={handleAssigned}
      />

      {assignmentHistory.length > 0 && (
        <div className="cl-client-history" style={{ marginTop: 20 }}>
          <h3 style={{ color: '#aaa', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Program History
          </h3>
          {assignmentHistory.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
              <span style={{ color: a.active ? '#c8ff00' : '#555' }}>{a.Program?.name}</span>
              <span style={{ color: '#444', fontSize: '12px' }}>{a.Program?.weeks}w</span>
              <span style={{ color: '#333', fontSize: '12px' }}>{a.start_date}</span>
              {a.active
                ? <span style={{ color: '#c8ff00', fontSize: '11px', fontWeight: 600 }}>ACTIVE</span>
                : <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => handleActivateProgram(a.id)}>Activate</button>
              }
            </div>
          ))}
        </div>
      )}

      <div className="cl-client-actions" style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
        <button className="btn-primary" onClick={() => onViewClientHome(selectedClientId, selectedClient?.name)}>
          Open Client View
        </button>
        <button className="btn-ghost" onClick={() => onStartWorkout(selectedClientId)}>
          Start Workout (Direct)
        </button>
        <button className="btn-danger" onClick={handleDeleteUserFull}>Delete Client</button>
      </div>

      <ClientWorkoutHistoryList clientId={selectedClientId} />
    </div>
  );

  return (
    <AdminLayout activeSection={navSection} onSectionChange={setAdminSection}>

      {/* ── Dashboard ── */}
      {adminSection === 'dashboard' && (
        <div className="admin-dashboard">
          <div className="admin-dashboard__header">
            <h2 className="admin-section-title">Admin Home</h2>
            <p className="admin-dashboard__sub">Manage clients, assign programs, and track progress.</p>
          </div>

          <div className="admin-stat-row">
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{clients.length}</span>
              <span className="admin-stat-card__label">Clients</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{programs.length}</span>
              <span className="admin-stat-card__label">Programs</span>
            </div>
          </div>

          <div className="admin-quick-actions">
            <p className="admin-quick-actions__label">Quick Actions</p>
            <div className="admin-quick-actions__row">
              <button
                className="admin-action-btn admin-action-btn--primary"
                onClick={() => setAdminSection('programs')}
              >
                Programs →
              </button>
              <AddClientInline onCreated={handleClientCreated} />
            </div>
          </div>

          <div className="admin-dashboard-grid">
            <ClientManager
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onClientDeleted={handleClientDeleted}
            />
            <div>
              {clientDetail || (
                <div className="cl-detail__empty">
                  <p>Select a client to view details</p>
                </div>
              )}
            </div>
          </div>

          {unassignedClients.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ color: '#aaa', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                Unassigned Clients
              </h3>
              <div>
                {unassignedClients.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ color: '#e0e0e0', flex: 1 }}>{c.name}</span>
                    <button className="btn-primary" onClick={() => handleClaimClient(c.id)}>
                      Claim Client
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Programs ── */}
      {adminSection === 'programs' && (
        <div>
          <h2 className="admin-section-title">Programs</h2>
          <ProgramList
            programs={programs}
            clients={clients}
            onProgramsChanged={handleProgramsChanged}
            onAssigned={handleAssigned}
            onOpenBuilder={handleOpenBuilder}
          />
        </div>
      )}

      {/* ── Client Portal ── */}
      {adminSection === 'clientPortal' && (
        <div>
          <h2 className="admin-section-title">Client Portal</h2>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px' }}>
            Select a client to open their portal.
          </p>

          <div style={{
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
              Launch a client portal
            </p>
            <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>
              Select a client below to open their training view.
            </p>
          </div>

          <div style={{
            maxWidth: '440px',
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            padding: '8px 0',
          }}>
            <ClientList
              clients={clients}
              selectionOnly={true}
              selectedClientId={selectedClientId}
              onSelectClient={(id) => {
                setSelectedClientId(id);
                const client = clients.find(c => c.id === id);
                onViewClientHome(id, client?.name);
              }}
              onClientCreated={handleClientCreated}
              onClientDeleted={handleClientDeleted}
            />
          </div>
        </div>
      )}

      {/* ── Program Builder ── */}
      {adminSection === 'programBuilder' && builderProgram && (
        <ProgramBuilder program={builderProgram} onBack={handleBuilderBack} />
      )}

      {/* ── Exercise Library (parked) ── */}
      {adminSection === 'videos' && (
        <AdminVideoUpload />
      )}

      {adminSection === 'exerciseLibrary' && (
        <ExerciseLibrary />
      )}

    </AdminLayout>
  );
}
