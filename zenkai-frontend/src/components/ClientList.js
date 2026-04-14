// * Renders client list with create, inline edit, delete, and selection.

import { useState } from 'react';
import { createClient, updateClient, deleteClient } from '../api/clientApi';

export default function ClientList({
  clients,
  selectedClientId,
  onSelectClient,
  onClientCreated,
  onClientDeleted
}) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createClient({ name: name.trim() });
      setName('');
      if (onClientCreated) onClientCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (client) => {
    setEditingId(client.id);
    setEditName(client.name || '');
    setError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setError(null);
  };

  const handleEditSave = async (id) => {
    if (!editName.trim()) return;
    setError(null);
    try {
      await updateClient(id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      if (onClientCreated) onClientCreated();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await deleteClient(id);
      if (onClientDeleted) onClientDeleted(id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="cl-panel">
      <div className="cl-create-row">
        <input
          className="cl-create-input"
          type="text"
          placeholder="New client name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          className="cl-create-btn"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
        >
          {loading ? '...' : '+ Add'}
        </button>
      </div>

      {error && <p className="cl-error">{error}</p>}

      <ul className="cl-list">
        {clients.length === 0 && (
          <li className="cl-empty">No clients yet.</li>
        )}
        {clients.map((client) => (
          <li
            key={client.id}
            className={`cl-item${selectedClientId === client.id ? ' cl-item--selected' : ''}`}
          >
            {editingId === client.id ? (
              <div className="cl-item__edit">
                <input
                  className="cl-create-input"
                  type="text"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditSave(client.id)}
                />
                <div className="cl-item__edit-actions">
                  <button className="prog-btn prog-btn--save" onClick={() => handleEditSave(client.id)}>Save</button>
                  <button
                    className="prog-btn"
                    onClick={handleEditCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="cl-item__row" onClick={() => onSelectClient(client.id)}>
                <span className="cl-item__name">{client.name}</span>
                <div className="cl-item__actions" onClick={(e) => e.stopPropagation()}>
                  <button className="prog-btn" onClick={() => handleEditStart(client)}>Edit</button>
                  <button className="prog-btn prog-btn--danger" onClick={() => handleDelete(client.id)}>Delete</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
