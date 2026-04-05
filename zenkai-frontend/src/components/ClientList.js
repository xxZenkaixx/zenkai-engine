// Fetches and displays clients. Handles loading + error state + refresh on create.
import { useEffect, useState } from 'react';
import { fetchClients } from '../api/clientApi';
import ClientForm from './ClientForm';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // load clients on initial mount
  useEffect(() => {
    loadClients();
  }, []);

  // fetches clients from backend and updates state
  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await fetchClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // UI states for async behavior
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* creates new client and triggers reload */}
      <ClientForm onClientCreated={loadClients} />

      <h2>Clients</h2>

      {/* render each client */}
      {clients.map((client) => (
        <div key={client.id} className="client-row">
          {client.name}
        </div>
      ))}
    </div>
  );
}
