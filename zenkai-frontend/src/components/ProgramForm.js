//* Handles program creation. Sends top-level program data to API and refreshes parent list.
import { useState } from 'react';
import { createProgram } from '../api/programApi';

export default function ProgramForm({ onProgramCreated }) {
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('');
  const [deloadWeeks, setDeloadWeeks] = useState('');

  // submit new program to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !weeks) return;

    const parsedDeloadWeeks = deloadWeeks
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value));

    await createProgram({
      name: name.trim(),
      weeks: Number(weeks),
      deload_weeks: parsedDeloadWeeks
    });

    setName('');
    setWeeks('');
    setDeloadWeeks('');
    onProgramCreated(); // reload program list
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Program</h2>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Program name"
      />

      <input
        type="number"
        value={weeks}
        onChange={(e) => setWeeks(e.target.value)}
        placeholder="Weeks"
      />

      <input
        type="text"
        value={deloadWeeks}
        onChange={(e) => setDeloadWeeks(e.target.value)}
        placeholder="Deload weeks (example: 4,8)"
      />

      <button type="submit">Add Program</button>
    </form>
  );
}
