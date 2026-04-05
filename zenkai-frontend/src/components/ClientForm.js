// Handles client creation. Sends name to API and notifies parent to refresh list.
import { useState } from 'react';
import { createClient } from '../api/clientApi';

export default function ClientForm({ onClientCreated }) {
  const [name, setName] = useState('');

  // submit new client to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) return;

    await createClient(name);
    setName('');
    onClientCreated(); // reload client list
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Client</h2>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Client name"
      />

      <button type="submit">Add Client</button>
    </form>
  );
}
