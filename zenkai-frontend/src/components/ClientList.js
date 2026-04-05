// * Renders client list and client creation form using parent-owned client state.
import { useState } from 'react';
import { createClient } from '../api/clientApi';

export default function ClientList({ clients, selectedClientId, onSelectClient, onClientCreated }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // * create a client, then ask parent to refresh shared client state
  const handleCreate = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await createClient(name.trim());
      setName('');

      if (onClientCreated) {
        onClientCreated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          <li
            key={client.id}
            onClick={() => onSelectClient(client.id)}
            style={{
              fontWeight: selectedClientId === client.id ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {client.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
