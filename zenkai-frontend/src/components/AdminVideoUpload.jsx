import React, { useState } from 'react';
import { API_BASE, getAuthHeaders } from '../api/base';
import { compressVideo } from '../utils/videoCompressor';

export default function AdminVideoUpload() {
  const [file, setFile]         = useState(null);
  const [status, setStatus]     = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading]   = useState(false);
  const [compressPct, setCompressPct] = useState(0);
  const [controller, setController] = useState(null);

  const handleFile = (e) => {
    setFile(e.target.files[0]);
    setStatus('');
    setVideoUrl('');
    setCompressPct(0);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    const ctrl = new AbortController();
    setController(ctrl);

    // 1. Compress (best-effort; fall back to original on any failure)
    let fileToUpload = file;
    try {
      const result = await compressVideo(file, {
        signal: ctrl.signal,
        onPhase: (p) =>
          setStatus(p === 'loading' ? 'Preparing compressor…' : 'Compressing video…'),
        onProgress: (n) => {
          const pct = Math.round(n * 100);
          setCompressPct(pct);
          setStatus(`Compressing… ${pct}%`);
        },
      });
      fileToUpload = result.compressedFile;
      if (!result.skipped) {
        const savedMB = ((result.originalSize - result.compressedSize) / 1048576).toFixed(1);
        setStatus(`Compressed — saved ${savedMB} MB. Uploading…`);
      } else {
        setStatus('Uploading…');
      }
    } catch (compErr) {
      if (ctrl.signal.aborted) {
        setStatus('Compression canceled');
        setController(null);
        setLoading(false);
        return;
      }
      console.warn('Compression failed, uploading original:', compErr);
      setStatus('Compression failed — uploading original…');
    }

    setController(null);

    // 2. Sign + upload (using compressed file)
    let sigData;
    try {
      const token = localStorage.getItem('zk_token');
      const sigRes = await fetch(`${API_BASE}/api/admin/videos/sign-upload`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!sigRes.ok) throw new Error('Could not get upload signature — check backend config');
      sigData = await sigRes.json();
    } catch (sigErr) {
      setStatus(`Error: ${sigErr.message}`);
      setLoading(false);
      return;
    }

    try {
      const { signature, timestamp, folder, api_key, cloud_name } = sigData;
      const formData = new FormData();
      formData.append('file', fileToUpload);
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

      setVideoUrl(json.secure_url);
      setStatus('Upload complete.');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', maxWidth: 600 }}>
      <h2 style={{ color: '#c8ff00', marginBottom: 16 }}>Upload Exercise Video</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <label className="avu-file-label">
          {file ? 'Change File' : 'Choose File'}
          <input
            type="file"
            accept="video/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
        {file && <span className="avu-file-name">{file.name}</span>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="avu-upload-btn"
          onClick={handleUpload}
          disabled={!file || loading}
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>
        {controller && (
          <button
            onClick={() => controller.abort()}
            style={{
              background: 'transparent',
              color: '#ff6666',
              border: '1px solid #ff4444',
              borderRadius: 6,
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {status && (
        <p style={{ color: status.startsWith('Error') ? '#ff6666' : '#c8ff00', marginBottom: 12 }}>
          {status}
        </p>
      )}

      {videoUrl && (
        <div>
          <p style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Cloudinary URL (copy into DB):</p>
          <code style={{
            display: 'block',
            background: '#111',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 12,
            color: '#c8ff00',
            wordBreak: 'break-all',
          }}>
            {videoUrl}
          </code>
        </div>
      )}
    </div>
  );
}
