import { useState, useEffect, useMemo } from 'react';

function getScheduledDays(startDate, weeks, programDays) {
  const map = {};
  if (!startDate || !weeks || !programDays?.length) return map;

  const start = new Date(startDate);
  if (isNaN(start)) return map;

  for (let week = 0; week < weeks; week++) {
    for (const pd of programDays) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + (pd.day_number - 1));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = pd;
      }
    }
  }

  return map;
}

export default function CalendarView({ activeProgram }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(null);

  useEffect(() => {
    setSelectedDateKey(null);
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }, [activeProgram]);

  const scheduledDays = useMemo(() => {
    if (!activeProgram?.start_date || !activeProgram?.Program) return {};

    const sortedDays = [...(activeProgram.Program.ProgramDays || [])]
      .sort((a, b) => a.day_number - b.day_number);

    return getScheduledDays(
      activeProgram.start_date,
      activeProgram.Program.weeks,
      sortedDays
    );
  }, [activeProgram]);

  if (!activeProgram?.Program) return null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
    setSelectedDateKey(null);
  };

  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
    setSelectedDateKey(null);
  };

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const rows = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const selectedProgramDay = selectedDateKey ? scheduledDays[selectedDateKey] : null;

  return (
    <div>
      <h3>Calendar</h3>

      <div>
        <button onClick={handlePrev}>{'<'}</button>
        <strong> {monthLabel} </strong>
        <button onClick={handleNext}>{'>'}</button>
      </div>

      <table>
        <thead>
          <tr>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((dayNum, colIdx) => {
                if (!dayNum) return <td key={colIdx} style={{ border: '1px solid #ccc', padding: '4px 8px' }} />;
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isScheduled = !!scheduledDays[dateKey];
                const isSelected = selectedDateKey === dateKey;
                return (
                  <td
                    key={colIdx}
                    onClick={() => isScheduled && setSelectedDateKey(isSelected ? null : dateKey)}
                    style={{
                      border: '1px solid #ccc',
                      padding: '4px 8px',
                      cursor: isScheduled ? 'pointer' : 'default',
                      fontWeight: isScheduled ? 'bold' : 'normal',
                      background: isSelected ? '#ddd' : 'transparent'
                    }}
                  >
                    {dayNum}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedProgramDay && (
        <div>
          <h4>{selectedDateKey} — {selectedProgramDay.name || `Day ${selectedProgramDay.day_number}`}</h4>
          <ul>
            {[...(selectedProgramDay.ExerciseInstances || [])]
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((ex) => {
                const weightDisplay = ex.target_weight != null ? ` @ ${ex.target_weight} lb` : '';
                return (
                  <li key={ex.id}>
                    {ex.order_index}. {ex.name} — {ex.target_sets}x{ex.target_reps}{weightDisplay}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
