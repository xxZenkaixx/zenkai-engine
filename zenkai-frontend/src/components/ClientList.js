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

  // * Parent must clear selected client and active program display if needed.
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
    <div>
      <h2>Clients</h2>

      <input
        type="text"
        placeholder="Client name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Add Client'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {clients.map((client) => (
          <li key={client.id}>
            {editingId === client.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <button onClick={() => handleEditSave(client.id)}>Save</button>
                <button onClick={handleEditCancel}>Cancel</button>
              </>
            ) : (
              <>
                <span
                  onClick={() => onSelectClient(client.id)}
                  style={{
                    fontWeight:
                      selectedClientId === client.id ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {client.name}
                </span>

                <button onClick={() => handleEditStart(client)}>Edit</button>
                <button onClick={() => handleDelete(client.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
