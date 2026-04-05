// Displays list of clients from API
import { useEffect, useState } from 'react';
import { fetchClients } from '../api/clientApi';

export default function ClientList() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await fetchClients();
    setClients(data);
  };

  return (
    <div>
      <h2>Clients</h2>
      {clients.map((client) => (
        <div key={client.id}>
          {client.name}
        </div>
      ))}
    </div>
  );
}
