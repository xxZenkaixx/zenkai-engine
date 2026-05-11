// *Renders exercise list for a selected day with create, edit, delete, and reorder.
// * Includes field-level validation and auto order_index assignment on create.
// * order_index swap uses existing PUT route via swapExerciseOrder.

import { useState, useEffect } from 'react';
import {
  fetchExerciseInstances,
  createExerciseInstance,
  updateExerciseInstance,
  deleteExerciseInstance,
  swapExerciseOrder
} from '../api/exerciseInstanceApi';
import { formatCableTarget } from '../utils/cableUtils';
import { API_BASE, getAuthHeaders } from '../api/base';
import { compressVideo } from '../utils/videoCompressor';


async function uploadVideoToCloudinary(file, authHeaders) {
  const sigRes = await fetch(`${API_BASE}/api/admin/videos/sign-upload`, { headers: authHeaders });
  if (!sigRes.ok) throw new Error('Failed to get upload signature');
  const { signature, timestamp, folder, api_key, cloud_name } = await sigRes.json();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);
  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`,
    { method: 'POST', body: formData }
  );
  const json = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(json.error?.message || 'Upload failed');
  return json.secure_url;
}

const EMPTY_FORM = {
  name: '',
  type: 'accessory',
  equipment_type: 'barbell',
  target_sets: '',
  target_reps: '',
  target_weight: '',
  rest_seconds: '',
  order_index: '',
  notes: '',
  progression_mode: '',
  progression_value: '',
  base_stack_weight: '',
  stack_step_value: '15',  // CHANGED: default to most common increment
  max_micro_levels: '',  // CHANGED: empty so select shows unselected
  cable_unit: 'lb',
  micro_type: 'none',
  micro_display_label: '',
  backoff_enabled: false,
  backoff_percent: 10,
  exercise_id: '',
  save_to_library: false,
  video_url: ''
};

const EMPTY_ERRORS = {
  name: '',
  type: '',
  target_sets: '',
  target_reps: '',
  rest_seconds: '',
  order_index: '',
  progression_mode: '',
  progression_value: ''
};

function validateForm(fields) {
  const errors = { ...EMPTY_ERRORS };
  let valid = true;

  if (!fields.name.trim()) { errors.name = 'Exercise name is required.'; valid = false; }
  if (!fields.type) { errors.type = 'Exercise type is required.'; valid = false; }
  if (!fields.target_sets || isNaN(Number(fields.target_sets))) { errors.target_sets = 'Sets must be a number.'; valid = false; }
  if (!fields.target_reps) { errors.target_reps = 'Reps are required.'; valid = false; }
  if (!fields.rest_seconds || isNaN(Number(fields.rest_seconds))) { errors.rest_seconds = 'Rest seconds must be a number.'; valid = false; }
  if (fields.order_index !== '' && isNaN(Number(fields.order_index))) { errors.order_index = 'Order index must be a number if provided.'; valid = false; }
  if (fields.type === 'custom') {
    if (!fields.progression_mode) { errors.progression_mode = 'Progression mode is required for custom exercises.'; valid = false; }
    if (fields.progression_value === '' || isNaN(Number(fields.progression_value))) { errors.progression_value = 'Progression value is required for custom exercises.'; valid = false; }
  }

  return { errors, valid };
}

// * All 5 cable fields must be non-empty to lock cable setup on admin side
function cableSetupComplete(fields) {
  return (
    fields.base_stack_weight !== '' &&
    fields.stack_step_value !== '' &&
    fields.max_micro_levels !== '' &&
    fields.cable_unit !== ''
  );
}

function buildPayload(fields) {
  const isCable = fields.equipment_type === 'cable';
  const isCustom = fields.type === 'custom';
  const isBodyweight = fields.type === 'bodyweight';
  return {
    name: fields.name,
    type: fields.type,
    equipment_type: isBodyweight ? 'bodyweight' : fields.equipment_type,
    video_url: fields.video_url?.trim() || null,
    target_sets: parseInt(fields.target_sets),
    target_reps: fields.target_reps,
    target_weight: isBodyweight ? null : (fields.target_weight !== '' ? parseFloat(fields.target_weight) : null),
    rest_seconds: parseInt(fields.rest_seconds),
    notes: fields.notes,
    progression_mode: isCustom ? fields.progression_mode : null,
    progression_value: isCustom && fields.progression_value !== '' ? parseFloat(fields.progression_value) : null,
    base_stack_weight: isCable && fields.base_stack_weight !== '' ? parseFloat(fields.base_stack_weight) : null,
    stack_step_value: isCable ? ([5, 10, 15, 20].includes(parseFloat(fields.stack_step_value)) ? parseFloat(fields.stack_step_value) : 10) : null,
    max_micro_levels: isCable ? (fields.micro_type === 'none' ? 0 : (fields.max_micro_levels !== '' ? parseInt(fields.max_micro_levels) : 0)) : null,
    cable_unit: isCable ? fields.cable_unit : null,
    micro_type: isCable ? (fields.micro_type || 'none') : null,
    micro_display_label: isCable && fields.micro_type !== 'none' && fields.micro_display_label !== '' ? fields.micro_display_label : null,
    cable_setup_locked: isCable ? cableSetupComplete(fields) : false,
    ...(isCable ? { current_micro_level: 0 } : {}),
    backoff_enabled: isBodyweight ? false : fields.backoff_enabled,
    backoff_percent: (!isBodyweight && fields.backoff_enabled) ? parseInt(fields.backoff_percent) : null,
    exercise_id: fields.exercise_id || null,
    saveToLibrary: !fields.exercise_id && fields.save_to_library === true,
  };
}

export default function ExerciseInstanceForm({ dayId }) {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState(EMPTY_ERRORS);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState(EMPTY_ERRORS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [library, setLibrary] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [editLibrarySearch, setEditLibrarySearch] = useState('');
  const [uploadingAddVideo, setUploadingAddVideo] = useState(false);
  const [uploadingEditVideo, setUploadingEditVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const [videoController, setVideoController] = useState(null);
  const [videoFileName, setVideoFileName]     = useState('');
  const [videoSizeInfo, setVideoSizeInfo]     = useState(null);

  useEffect(() => { if (!dayId) return; loadExercises(); }, [dayId]);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/exercises`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => setLibrary(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const loadExercises = async () => {
    try {
      const data = await fetchExerciseInstances(dayId);
      setExercises([...data].sort((a, b) => a.order_index - b.order_index));
    } catch (err) { setError(err.message); }
  };

  const doVideoUpload = async (file, setField, setBusy) => {
    const ctrl = new AbortController();
    setVideoController(ctrl);
    setBusy(true);
    setVideoStatus('');
    const originalMB = (file.size / 1048576).toFixed(1);
    setVideoSizeInfo({ originalMB });
    try {
      let fileToUpload = file;
      try {
        const result = await compressVideo(file, {
          signal: ctrl.signal,
          onPhase: (p) =>
            setVideoStatus(p === 'loading' ? 'Preparing compressor…' : 'Compressing video…'),
          onProgress: (n) => setVideoStatus(`Compressing… ${Math.round(n * 100)}%`),
        });
        fileToUpload = result.compressedFile;
        if (!result.skipped) {
          const compressedMB = (result.compressedSize / 1048576).toFixed(1);
          const savedMB = ((result.originalSize - result.compressedSize) / 1048576).toFixed(1);
          setVideoSizeInfo({ originalMB, compressedMB, savedMB });
        }
      } catch (compErr) {
        if (ctrl.signal.aborted) {
          setVideoStatus('Compression canceled');
          setVideoFileName('');
          setVideoSizeInfo(null);
          setVideoController(null);
          setBusy(false);
          return;
        }
        console.warn('Compression failed, uploading original:', compErr);
        setVideoStatus('Compression failed — uploading original…');
      }
      setVideoController(null);
      setVideoStatus('Uploading to Cloudinary…');
      const url = await uploadVideoToCloudinary(fileToUpload, getAuthHeaders());
      setField('video_url', url);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err.message);
    } finally {
      setVideoController(null);
      setBusy(false);
      if (!ctrl.signal.aborted) setVideoStatus('');
    }
  };

  const handleAddFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setVideoFileName(file.name);
    await doVideoUpload(file, sf, setUploadingAddVideo);
  };

  const handleEditFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setVideoFileName(file.name);
    await doVideoUpload(file, se, setUploadingEditVideo);
  };

  const autofillFromLibrary = (lib, isEdit) => {
    const patch = {
      name: lib.name,
      type: lib.type || 'accessory',
      equipment_type: lib.equipment_type || 'barbell',
      notes: lib.notes ?? '',
      target_sets: lib.default_target_sets ?? '',
      target_reps: lib.default_target_reps ?? '',
      exercise_id: lib.id,
    };
    if (isEdit) {
      setEditFields(prev => ({ ...prev, ...patch }));
    } else {
      setForm(prev => ({ ...prev, ...patch }));
    }
  };

  const onLibrarySearchChange = (val, isEdit) => {
    if (isEdit) setEditLibrarySearch(val); else setLibrarySearch(val);
    const match = library.find(l => l.name === val);
    if (match) autofillFromLibrary(match, isEdit);
    if (!match && val === '') {
      const clearPatch = { exercise_id: '' };
      if (isEdit) setEditFields(prev => ({ ...prev, ...clearPatch }));
      else setForm(prev => ({ ...prev, ...clearPatch }));
    }
  };

  const resolveOrderIndex = (rawValue) => {
    if (rawValue !== '') return parseInt(rawValue);
    if (exercises.length === 0) return 1;
    return Math.max(...exercises.map((ex) => ex.order_index)) + 1;
  };

  const handleCreate = async () => {
    const { errors, valid } = validateForm(form);
    setFormErrors(errors);
    if (!valid) return;
    setLoading(true); setError(null);
    try {
      await createExerciseInstance({ ...buildPayload(form), program_day_id: dayId, order_index: resolveOrderIndex(form.order_index) });
      setForm(EMPTY_FORM); setFormErrors(EMPTY_ERRORS); setLibrarySearch('');
      setVideoFileName(''); setVideoSizeInfo(null);
      await loadExercises();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleEditStart = (ex) => {
    setEditingId(ex.id); setEditErrors(EMPTY_ERRORS); setEditLibrarySearch('');
    setVideoFileName(''); setVideoSizeInfo(null);
    setEditFields({
      name: ex.name, type: ex.type || 'accessory', equipment_type: ex.equipment_type || 'barbell',
      target_sets: ex.target_sets, target_reps: ex.target_reps, target_weight: ex.target_weight ?? '',
      rest_seconds: ex.rest_seconds, order_index: ex.order_index, notes: ex.notes ?? '',
      progression_mode: ex.progression_mode ?? '', progression_value: ex.progression_value ?? '',
      base_stack_weight: ex.base_stack_weight ?? '', stack_step_value: [5, 10, 15, 20].includes(parseFloat(ex.stack_step_value)) ? String(parseFloat(ex.stack_step_value)) : '10',
      max_micro_levels: (ex.micro_type === 'none' || ex.micro_type == null) ? 0 : (ex.max_micro_levels ?? 0),
      cable_unit: ex.cable_unit ?? 'lb',
      micro_type: ex.micro_type ?? 'none',
      micro_display_label: ex.micro_display_label ?? '',
      backoff_enabled: ex.backoff_enabled || false,
      backoff_percent: ex.backoff_percent ?? 10,
      exercise_id: ex.exercise_id ?? '',
      video_url: ex.video_url ?? '',
      save_to_library: false,
    });
  };

  const handleEditSave = async (id) => {
    const { errors, valid } = validateForm(editFields);
    setEditErrors(errors);
    if (!valid) return;
    try {
      await updateExerciseInstance(id, { ...buildPayload(editFields), order_index: parseInt(editFields.order_index) });
      setEditingId(null); setEditFields(EMPTY_FORM); setEditErrors(EMPTY_ERRORS);
      await loadExercises();
    } catch (err) {
      if (err.field) { setEditErrors((prev) => ({ ...prev, [err.field]: err.message })); setError(null); return; }
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExerciseInstance(id);
      if (editingId === id) { setEditingId(null); setEditFields(EMPTY_FORM); setEditErrors(EMPTY_ERRORS); }
      await loadExercises();
    } catch (err) { setError(err.message); }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    try { await swapExerciseOrder(exercises[index], exercises[index - 1]); await loadExercises(); } catch (err) { setError(err.message); }
  };

  const handleMoveDown = async (index) => {
    if (index === exercises.length - 1) return;
    try { await swapExerciseOrder(exercises[index], exercises[index + 1]); await loadExercises(); } catch (err) { setError(err.message); }
  };

  const sf = (field, val) => setForm({ ...form, [field]: val });
  const se = (field, val) => setEditFields({ ...editFields, [field]: val });

  return (
    <div className="ex-form">
      <div className="ex-list">
        {exercises.length === 0 && (
          <p className="ex-list__empty">No exercises yet — add your first exercise below.</p>
        )}
        {exercises.map((ex, index) => (
          <div key={ex.id} className="ex-row">
            {editingId === ex.id ? (
              <div className="ex-edit-form">
                <div className="ex-edit-form__row">
                  <input
                    className="prog-input"
                    list="zk-exercise-library"
                    placeholder="Search library (optional)"
                    value={editLibrarySearch}
                    onChange={(e) => onLibrarySearchChange(e.target.value, true)}
                  />
                  {editFields.exercise_id && (
                    <button
                      className="prog-btn"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => { setEditLibrarySearch(''); setEditFields(prev => ({ ...prev, exercise_id: '' })); }}
                    >Unlink</button>
                  )}
                </div>
                <div className="ex-edit-form__row">
                  <input
                    className="prog-input ex-edit-form__name"
                    placeholder="Exercise name *"
                    value={editFields.name}
                    onChange={(e) => se('name', e.target.value)}
                  />
                  <select className="prog-input" value={editFields.type} onChange={(e) => se('type', e.target.value)}>
                    <option value="compound">Compound</option>
                    <option value="accessory">Accessory</option>
                    <option value="custom">Custom</option>
                    <option value="bodyweight">Bodyweight</option>
                  </select>
                  {editFields.type !== 'bodyweight' && (
                    <select className="prog-input" value={editFields.equipment_type} onChange={(e) => se('equipment_type', e.target.value)}>
                      <option value="barbell">Barbell</option>
                      <option value="dumbbell">Dumbbell</option>
                      <option value="machine">Machine</option>
                      <option value="cable">Cable</option>
                    </select>
                  )}
                </div>

                {editFields.type === 'custom' && (
                  <div className="ex-edit-form__row">
                    <select className="prog-input" value={editFields.progression_mode} onChange={(e) => se('progression_mode', e.target.value)}>
                      <option value="">Progression mode *</option>
                      <option value="percent">Percent</option>
                      <option value="absolute">Absolute</option>
                    </select>
                    <input
                      className="prog-input"
                      placeholder="Progression value *"
                      value={editFields.progression_value}
                      onChange={(e) => se('progression_value', e.target.value)}
                    />
                  </div>
                )}

                {editFields.equipment_type === 'cable' && editFields.type !== 'bodyweight' && (
                  <>
                    <div className="ex-edit-form__row">
                      <input
                        className="prog-input"
                        placeholder="Starting Pin Weight"
                        value={editFields.base_stack_weight}
                        onChange={(e) => se('base_stack_weight', e.target.value)}
                      />
                      <select
                        className="prog-input"
                        value={editFields.stack_step_value}
                        onChange={(e) => se('stack_step_value', e.target.value)}>
                        <option value="" disabled>Stack Increment</option>  {/* CHANGED: added label */}
                        <option value="5">5</option>
                        <option value="7.5">7.5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                      </select>
                      <select
                        className="prog-input"
                        value={editFields.cable_unit}
                        onChange={(e) => se('cable_unit', e.target.value)}>
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    <div className="ex-edit-form__row">
                      <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>Micro Adjustments</span>
                      <select
                        className="prog-input"
                        value={editFields.micro_type}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFields(prev => ({
                            ...prev,
                            micro_type: val,
                            max_micro_levels: val === 'none' ? 0 : ''  // CHANGED: no default when slider chosen
                          }));
                        }}>
                        <option value="none">No micro</option>
                        <option value="slider">Slider</option>
                        <option value="knob">Knob</option>
                      </select>
                      {editFields.micro_type !== 'none' && (
                        <>
                          {/* CHANGED: replaced free-text input with select, options 1 and 2 */}
                          <select
                            className="prog-input"
                            value={editFields.max_micro_levels}
                            onChange={(e) => se('max_micro_levels', e.target.value)}>
                            <option value="" disabled>{editFields.micro_type === 'slider' ? 'Number of sliders' : 'Number of knob turns'}</option>  {/* CHANGED */}
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                          {/* REMOVED: micro_display_label input — field still sent in payload */}
                        </>
                      )}
                    </div>
                  </>
                )}

                <div className="ex-edit-form__row">
                  <input className="prog-input" placeholder="Sets *" value={editFields.target_sets} onChange={(e) => se('target_sets', e.target.value)} />
                  <input className="prog-input" placeholder="Reps *" value={editFields.target_reps} onChange={(e) => se('target_reps', e.target.value)} />
                  {editFields.type !== 'bodyweight' && editFields.equipment_type !== 'cable' && (
                    <input className="prog-input" placeholder="Weight (optional)" value={editFields.target_weight} onChange={(e) => se('target_weight', e.target.value)} />
                  )}
                  <input className="prog-input" placeholder="Rest (sec) *" value={editFields.rest_seconds} onChange={(e) => se('rest_seconds', e.target.value)} />
                </div>

                {editFields.type !== 'bodyweight' && (
                  <div className="ex-edit-form__row">
                    <label
                      style={{
                        color: '#888',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editFields.backoff_enabled}
                        onChange={(e) => se('backoff_enabled', e.target.checked)}
                      />
                      Back-off sets
                    </label>

                    {editFields.backoff_enabled && (
                      <select
                        className="prog-input"
                        value={editFields.backoff_percent}
                        onChange={(e) => se('backoff_percent', e.target.value)}
                      >
                        <option value={10}>10% reduction</option>
                        <option value={15}>15% reduction</option>
                        <option value={20}>20% reduction</option>
                      </select>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                  <input
                    className="prog-input"
                    placeholder="Paste video URL (optional)"
                    value={editFields.video_url}
                    onChange={(e) => se('video_url', e.target.value)}
                  />
                  {editFields.video_url && !uploadingEditVideo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#c8ff00', fontSize: 13 }}>
                        {videoFileName ? '✓ Video uploaded' : '✓ Video linked'}
                      </span>
                      {videoFileName && videoSizeInfo?.compressedMB ? (
                        <span style={{ color: '#666', fontSize: 12 }}>
                          {videoSizeInfo.originalMB} MB → {videoSizeInfo.compressedMB} MB · saved {videoSizeInfo.savedMB} MB
                        </span>
                      ) : videoFileName ? (
                        <span style={{ color: '#666', fontSize: 12 }}>{videoFileName}</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => { se('video_url', ''); setVideoFileName(''); setVideoSizeInfo(null); }}
                        style={{ color: '#777', background: 'transparent', border: '1px solid #333', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : uploadingEditVideo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#c8ff00', fontSize: 13 }}>
                        {videoStatus || 'Uploading…'}
                        {videoSizeInfo?.originalMB && ` · ${videoSizeInfo.originalMB} MB`}
                      </span>
                      {videoController && (
                        <button
                          type="button"
                          onClick={() => videoController.abort()}
                          style={{ background: 'transparent', color: '#ff6666', border: '1px solid #ff4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ) : (
                    <label
                      className="prog-btn"
                      style={{ color: '#c8ff00', borderColor: '#3a4a00', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                    >
                      Upload Video
                      <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleEditFileSelect} />
                    </label>
                  )}
                </div>

                <div className="ex-edit-form__row">
                  <input className="prog-input ex-edit-form__notes" placeholder="Notes (optional)" value={editFields.notes} onChange={(e) => se('notes', e.target.value)} />
                  <input className="prog-input" placeholder="Order #" value={editFields.order_index} onChange={(e) => se('order_index', e.target.value)} />
                </div>

                {(editErrors.name || editErrors.type || editErrors.target_sets || editErrors.target_reps || editErrors.rest_seconds || editErrors.progression_mode || editErrors.progression_value) && (
                  <p className="ex-error">
                    {editErrors.name || editErrors.type || editErrors.target_sets || editErrors.target_reps || editErrors.rest_seconds || editErrors.progression_mode || editErrors.progression_value}
                  </p>
                )}

                {!editFields.exercise_id && (
                  <div className="ex-edit-form__row">
                    <label style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editFields.save_to_library}
                        onChange={(e) => se('save_to_library', e.target.checked)}
                      />
                      Also update Exercise Library with these changes
                    </label>
                  </div>
                )}

                <div className="ex-edit-form__actions">
                  <button className="prog-btn prog-btn--save" onClick={() => handleEditSave(ex.id)}>Save</button>
                  <button className="prog-btn" onClick={() => { setEditingId(null); setEditFields(EMPTY_FORM); setEditErrors(EMPTY_ERRORS); setError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="ex-row__inner">
                <div className="ex-row__info">
                  <span className="ex-row__name">{ex.name}</span>
                  <span className="ex-row__meta">
                    {ex.type} · {ex.equipment_type || 'barbell'} · {ex.target_sets}×{ex.target_reps}
                    {ex.equipment_type === 'cable' && ex.cable_setup_locked
                      ? ` · ${formatCableTarget({ baseStackWeight: ex.base_stack_weight, stackStepValue: ex.stack_step_value, currentMicroLevel: 0, maxMicroLevels: ex.max_micro_levels, cableUnit: ex.cable_unit, microType: ex.micro_type, microDisplayLabel: ex.micro_display_label }) || 'Cable Setup'}`
                      : ex.target_weight != null ? ` · ${ex.target_weight} lb` : ''}
                  </span>
                  {ex.notes && <span className="ex-row__notes">{ex.notes}</span>}
                </div>
                <div className="ex-row__controls">
                  <button className="prog-btn" onClick={() => handleMoveUp(index)} disabled={index === 0}>↑</button>
                  <button className="prog-btn" onClick={() => handleMoveDown(index)} disabled={index === exercises.length - 1}>↓</button>
                  <button className="prog-btn" onClick={() => handleEditStart(ex)}>Edit</button>
                  <button className="prog-btn prog-btn--danger" onClick={() => handleDelete(ex.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="ex-error">{error}</p>}

      <div className="ex-add-form">
        <p className="ex-add-form__label">Add Exercise</p>

        <div className="ex-add-form__row">
          <input
            className="prog-input"
            list="zk-exercise-library"
            placeholder="Search library (optional)"
            value={librarySearch}
            onChange={(e) => onLibrarySearchChange(e.target.value, false)}
          />
          {form.exercise_id && (
            <button
              className="prog-btn"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => { setLibrarySearch(''); setForm(prev => ({ ...prev, exercise_id: '' })); }}
            >Unlink</button>
          )}
        </div>

        <div className="ex-add-form__row">
          <input
            className="prog-input ex-add-form__name"
            placeholder="Exercise name *"
            value={form.name}
            onChange={(e) => sf('name', e.target.value)}
          />
          <select className="prog-input" value={form.type} onChange={(e) => sf('type', e.target.value)}>
            <option value="compound">Compound</option>
            <option value="accessory">Accessory</option>
            <option value="custom">Custom</option>
            <option value="bodyweight">Bodyweight</option>
          </select>
          {form.type !== 'bodyweight' && (
            <select className="prog-input" value={form.equipment_type} onChange={(e) => sf('equipment_type', e.target.value)}>
              <option value="barbell">Barbell</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="machine">Machine</option>
              <option value="cable">Cable</option>
            </select>
          )}
        </div>

        {form.type === 'custom' && (
          <div className="ex-add-form__row">
            <select className="prog-input" value={form.progression_mode} onChange={(e) => sf('progression_mode', e.target.value)}>
              <option value="">Progression mode *</option>
              <option value="percent">Percent</option>
              <option value="absolute">Absolute</option>
            </select>
            <input
              className="prog-input"
              placeholder="Progression value *"
              value={form.progression_value}
              onChange={(e) => sf('progression_value', e.target.value)}
            />
          </div>
        )}

        {form.equipment_type === 'cable' && form.type !== 'bodyweight' && (
          <>
            <div className="ex-add-form__row">
              <input
                className="prog-input"
                placeholder="Starting Pin Weight"
                value={form.base_stack_weight}
                onChange={(e) => sf('base_stack_weight', e.target.value)}
              />
              <select
                className="prog-input"
                value={form.stack_step_value}
                onChange={(e) => sf('stack_step_value', e.target.value)}>
                <option value="" disabled>Stack Increment</option>  {/* CHANGED: added label */}
                <option value="5">5</option>
                <option value="7.5">7.5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
              <select
                className="prog-input"
                value={form.cable_unit}
                onChange={(e) => sf('cable_unit', e.target.value)}>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div className="ex-add-form__row">
              <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>Micro Adjustments</span>
              <select
                className="prog-input"
                value={form.micro_type}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    micro_type: val,
                    max_micro_levels: val === 'none' ? 0 : ''  // CHANGED: no default when slider chosen
                  }));
                }}>
                <option value="none">No micro</option>
                <option value="slider">Slider</option>
                <option value="knob">Knob</option>
              </select>
              {form.micro_type !== 'none' && (
                <>
                  {/* CHANGED: replaced free-text input with select, options 1 and 2 */}
                  <select
                    className="prog-input"
                    value={form.max_micro_levels}
                    onChange={(e) => sf('max_micro_levels', e.target.value)}>
                    <option value="" disabled>{form.micro_type === 'slider' ? 'Number of sliders' : 'Number of knob turns'}</option>  {/* CHANGED */}
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                  {/* REMOVED: micro_display_label input — field still sent in payload */}
                </>
              )}
            </div>
          </>
        )}

        <div className="ex-add-form__row">
          <input className="prog-input" placeholder="Sets *" value={form.target_sets} onChange={(e) => sf('target_sets', e.target.value)} />
          <input className="prog-input" placeholder="Reps *" value={form.target_reps} onChange={(e) => sf('target_reps', e.target.value)} />
          {form.type !== 'bodyweight' && form.equipment_type !== 'cable' && (
            <input className="prog-input" placeholder="Weight (optional)" value={form.target_weight} onChange={(e) => sf('target_weight', e.target.value)} />
          )}
          <input className="prog-input" placeholder="Rest (sec) *" value={form.rest_seconds} onChange={(e) => sf('rest_seconds', e.target.value)} />
        </div>

        {form.type !== 'bodyweight' && (
          <div className="ex-add-form__row">
            <label style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.backoff_enabled}
                onChange={(e) => sf('backoff_enabled', e.target.checked)}
              />
              Back-off sets
            </label>
            {form.backoff_enabled && (
              <select className="prog-input" value={form.backoff_percent} onChange={(e) => sf('backoff_percent', e.target.value)}>
                <option value={10}>10% reduction</option>
                <option value={15}>15% reduction</option>
                <option value={20}>20% reduction</option>
              </select>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          <input
            className="prog-input"
            placeholder="Paste video URL (optional)"
            value={form.video_url}
            onChange={(e) => sf('video_url', e.target.value)}
          />
          {form.video_url && !uploadingAddVideo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#c8ff00', fontSize: 13 }}>
                {videoFileName ? '✓ Video uploaded' : '✓ Video linked'}
              </span>
              {videoFileName && videoSizeInfo?.compressedMB ? (
                <span style={{ color: '#666', fontSize: 12 }}>
                  {videoSizeInfo.originalMB} MB → {videoSizeInfo.compressedMB} MB · saved {videoSizeInfo.savedMB} MB
                </span>
              ) : videoFileName ? (
                <span style={{ color: '#666', fontSize: 12 }}>{videoFileName}</span>
              ) : null}
              <button
                type="button"
                onClick={() => { sf('video_url', ''); setVideoFileName(''); setVideoSizeInfo(null); }}
                style={{ color: '#777', background: 'transparent', border: '1px solid #333', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
              >
                Remove
              </button>
            </div>
          ) : uploadingAddVideo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#c8ff00', fontSize: 13 }}>
                {videoStatus || 'Uploading…'}
                {videoSizeInfo?.originalMB && ` · ${videoSizeInfo.originalMB} MB`}
              </span>
              {videoController && (
                <button
                  type="button"
                  onClick={() => videoController.abort()}
                  style={{ background: 'transparent', color: '#ff6666', border: '1px solid #ff4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <label
              className="prog-btn"
              style={{ color: '#c8ff00', borderColor: '#3a4a00', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
            >
              Upload Video
              <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleAddFileSelect} />
            </label>
          )}
        </div>

        <div className="ex-add-form__row">
          <input className="prog-input ex-add-form__notes" placeholder="Notes (optional)" value={form.notes} onChange={(e) => sf('notes', e.target.value)} />
          <button className="ex-add-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>

        {!form.exercise_id && (
          <div className="ex-add-form__row">
            <label style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.save_to_library}
                onChange={(e) => sf('save_to_library', e.target.checked)}
              />
              Also save to Exercise Library
            </label>
          </div>
        )}

        {(formErrors.name || formErrors.type || formErrors.target_sets || formErrors.target_reps || formErrors.rest_seconds || formErrors.progression_mode || formErrors.progression_value) && (
          <p className="ex-error">
            {formErrors.name || formErrors.type || formErrors.target_sets || formErrors.target_reps || formErrors.rest_seconds || formErrors.progression_mode || formErrors.progression_value}
          </p>
        )}
      </div>
      <datalist id="zk-exercise-library">
        {library.map(l => <option key={l.id} value={l.name} />)}
      </datalist>
    </div>
  );
}
