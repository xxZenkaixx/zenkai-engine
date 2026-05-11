import React, { useState } from 'react';
import { API_BASE, getAuthHeaders } from '../api/base';

export default function AdminVideoUpload() {
  const [file, setFile]         = useState(null);
  const [status, setStatus]     = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleFile = (e) => {
    setFile(e.target.files[0]);
    setStatus('');
    setVideoUrl('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Requesting upload signature...');

    try {
      const token = localStorage.getItem('zk_token');

      const sigRes = await fetch(`${API_BASE}/api/admin/videos/sign-upload`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, folder, api_key, cloud_name } = await sigRes.json();

      setStatus('Uploading to Cloudinary...');
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

      <input
        type="file"
        accept="video/*"
        onChange={handleFile}
        style={{ marginBottom: 12, display: 'block', color: '#aaa' }}
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          background: loading || !file ? '#222' : '#c8ff00',
          color: '#000',
          border: 'none',
          padding: '10px 24px',
          borderRadius: 8,
          fontWeight: 700,
          cursor: file && !loading ? 'pointer' : 'default',
          marginBottom: 16,
        }}
      >
        {loading ? 'Uploading…' : 'Upload'}
      </button>

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
