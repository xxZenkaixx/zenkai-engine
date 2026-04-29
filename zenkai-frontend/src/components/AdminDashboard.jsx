// * Top-level admin view. Owns clients, programs, selectedClientId, and activeProgram state.
// * Keeps program builder independent from client selection.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchClients } from '../api/clientApi';
import { fetchPrograms } from '../api/programApi';
import { fetchActiveProgram, deactivateProgram, fetchAssignmentHistory } from '../api/clientProgramApi';
import AdminLayout from './AdminLayout';
import ClientList from './ClientList';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import ProgramList from './ProgramList';
import ProgramBuilder from './ProgramBuilder';
import ClientProgramAssignment from './ClientProgramAssignment';

export default function AdminDashboard({ onStartWorkout, onViewClientHome }) {
  const { user } = useAuth();

  const [adminSection, setAdminSection] = useState(() => {
    const saved = localStorage.getItem('adminSection');
    if (
      saved === 'dashboard' ||
      saved === 'clients' ||
      saved === 'programs' ||
      saved === 'programBuilder' ||
      saved === 'clientPortal'
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const [clientData, programData] = await Promise.all([
          fetchClients(),
          fetchPrograms()
        ]);
        setClients(clientData);
        setPrograms(programData);
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
      await fetch(`http://localhost:3001/api/client-programs/${assignmentId}/activate`, { method: 'PATCH' });
      const [programData, historyData] = await Promise.all([
        fetchActiveProgram(selectedClientId),
        fetchAssignmentHistory(selectedClientId)
      ]);
      setActiveProgram(programData || null);
      setAssignmentHistory(Array.isArray(historyData) ? historyData : []);
    } catch {}
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

  // * Client detail block — shared between Dashboard and Clients sections
  const clientDetail = selectedClientId && (
    <div className="cl-client-detail">
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
              <button
                className="admin-action-btn"
                onClick={() => setAdminSection('clients')}
              >
                Clients →
              </button>
            </div>
          </div>

          {selectedClient && (
            <div className="admin-client-snapshot">
              <p className="admin-client-snapshot__label">Selected Client</p>
              <div className="admin-client-snapshot__card">
                <div className="admin-client-snapshot__name">{selectedClient.name}</div>
                <div className="admin-client-snapshot__program">
                  {activeProgramLoading && <span style={{ color: '#555' }}>Loading program...</span>}
                  {!activeProgramLoading && activeProgram?.Program && (
                    <span>
                      <span className="admin-client-snapshot__prog-name">{activeProgram.Program.name}</span>
                      <span className="admin-client-snapshot__prog-meta"> · {activeProgram.Program.weeks} weeks</span>
                    </span>
                  )}
                  {!activeProgramLoading && !activeProgram && (
                    <span style={{ color: '#444' }}>No program assigned</span>
                  )}
                </div>
                <div className="admin-client-snapshot__actions">
                  <button className="btn-primary" onClick={() => onViewClientHome(selectedClientId, selectedClient?.name)}>
                    Open Client View
                  </button>
                  <button className="btn-ghost" onClick={() => onStartWorkout(selectedClientId)}>
                    Start Workout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Clients ── */}
      {adminSection === 'clients' && (
        <div>
          <h2 className="admin-section-title">Clients</h2>
          <div className="cl-layout">
            <div className="cl-sidebar">
              <ClientList
                clients={clients}
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
                onClientCreated={handleClientCreated}
                onClientDeleted={handleClientDeleted}
              />
            </div>
            <div className="cl-detail">
              {clientDetail || (
                <div className="cl-detail__empty">
                  <p className="cl-detail__empty-text">Select a client to view details</p>
                </div>
              )}
            </div>
          </div>
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
      {adminSection === 'exerciseLibrary' && (
        <div className="admin-parked-panel">
          <p className="admin-parked-panel__title">Exercise Library</p>
          <p className="admin-parked-panel__sub">Parked — coming in a future release.</p>
        </div>
      )}

    </AdminLayout>
  );
}
