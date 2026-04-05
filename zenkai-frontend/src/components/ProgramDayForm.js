// * Creates a day for the selected program and refreshes the parent day list.
import { useState } from 'react';
import { createProgramDay } from '../api/programDayApi';

export default function ProgramDayForm({ programId, onDayCreated }) {
  const [dayNumber, setDayNumber] = useState('');
  const [name, setName] = useState('');

  // * submit new program day to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!programId || !dayNumber || !name.trim()) return;

    await createProgramDay({
      program_id: programId,
      day_number: Number(dayNumber),
      name: name.trim()
    });

    setDayNumber('');
    setName('');
    onDayCreated();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add Day</h3>

      <input
        type="number"
        value={dayNumber}
        onChange={(e) => setDayNumber(e.target.value)}
        placeholder="Day number"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Day name"
      />

      <button type="submit">Add Day</button>
    </form>
  );
}
