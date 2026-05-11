import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE, getAuthHeaders } from '../api/base';

const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const TYPE_OPTIONS      = ['compound', 'accessory', 'custom'];

export default function AdminExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeVideo, setActiveVideo] = useState(null);

  const [search, setSearch]               = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [type, setType]                   = useState('');
  const [bodyPart, setBodyPart]           = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (search)        params.set('search',         search);
    if (equipmentType) params.set('equipment_type', equipmentType);
    if (type)          params.set('type',           type);
    if (bodyPart)      params.set('body_part',      bodyPart);

    fetch(`${API_BASE}/api/admin/exercises?${params.toString()}`, {
      headers: getAuthHeaders(),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error(data.error || 'Failed to load');
        setExercises(data);
        setError('');
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [search, equipmentType, type, bodyPart]);

  const bodyPartOptions = useMemo(
    () => [...new Set(exercises.map(e => e.body_part).filter(Boolean))].sort(),
    [exercises]
  );

  const clearFilters = () => {
    setSearch(''); setEquipmentType(''); setType(''); setBodyPart('');
  };

  const inputStyle = {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8,
    color: '#e0e0e0', padding: '8px 12px', fontSize: 13,
  };

  return (
    <div style={{ padding: 24, color: '#e0e0e0' }}>
      <h2 style={{ color: '#c8ff00', marginBottom: 16 }}>Exercise Library</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: '100%', maxWidth: 400 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={equipmentType} onChange={e => setEquipmentType(e.target.value)} style={inputStyle}>
            <option value="">All Equipment</option>
            {EQUIPMENT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            <option value="">All Types</option>
            {TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={bodyPart} onChange={e => setBodyPart(e.target.value)} style={inputStyle}>
            <option value="">All Body Parts</option>
            {bodyPartOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {(search || equipmentType || type || bodyPart) && (
            <button onClick={clearFilters} style={{
              ...inputStyle, color: '#c8ff00', cursor: 'pointer',
              borderColor: '#3a4a00', background: '#0c1000',
            }}>Clear</button>
          )}
        </div>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading…</p>}
      {error   && <p style={{ color: '#ff6666' }}>Error: {error}</p>}
      {!loading && !error && exercises.length === 0 && (
        <p style={{ color: '#666' }}>No exercises found.</p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
      }}>
        {exercises.map(ex => (
          <div key={ex.id} style={{
            background: '#141414', border: '1px solid #1e1e1e',
            borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              background: '#000', height: 130, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: ex.video_url ? 'pointer' : 'default',
            }} onClick={() => ex.video_url && setActiveVideo(ex.video_url)}>
              {ex.video_url ? (
                <>
                  <video src={ex.video_url} preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                  <div style={{
                    position: 'absolute', color: '#c8ff00', fontSize: 32,
                    background: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                    width: 48, height: 48, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>▶</div>
                </>
              ) : (
                <span style={{ color: '#333', fontSize: 11 }}>No video</span>
              )}
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#e0e0e0' }}>{ex.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#777' }}>
                {ex.equipment_type} · {ex.type}{ex.body_part ? ` · ${ex.body_part}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {activeVideo && (
        <div onClick={() => setActiveVideo(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 250, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: '#0a0a0a', border: '1px solid #333',
            borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh',
            overflow: 'hidden',
          }}>
            <button onClick={() => setActiveVideo(null)} style={{
              position: 'absolute', top: 8, right: 12,
              background: 'rgba(0,0,0,0.6)', border: '1px solid #333',
              color: '#fff', fontSize: 22, width: 36, height: 36,
              borderRadius: '50%', cursor: 'pointer', zIndex: 1,
            }}>×</button>
            <video src={activeVideo} autoPlay muted loop playsInline controls
              style={{ width: '100%', maxHeight: '90vh', display: 'block', background: '#000' }} />
          </div>
        </div>
      )}
    </div>
  );
}
