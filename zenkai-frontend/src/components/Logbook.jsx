import { useState, useEffect, useMemo } from 'react';
import { fetchWorkoutSessions, fetchExerciseList } from '../api/historyApi';
import ClientWorkoutSessionDetail from './ClientWorkoutSessionDetail';
import LogbookMonthChips from './LogbookMonthChips';
import LogbookDayList from './LogbookDayList';
import LogbookDayExercises from './LogbookDayExercises';
import LogbookExerciseHistory from './LogbookExerciseHistory';
import LogbookSearch from './LogbookSearch';
import './Logbook.css';

const monthKeyOf = (d) => (d || '').slice(0, 7);                       // "2026-06"
const monthLabelOf = (k) => {
  const [y, m] = k.split('-');
  return new Date(+y, +m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

export default function Logbook({ clientId }) {
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);   // global, carries note_count + last_note_date
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [activeDay, setActiveDay] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true); setError(null);
    Promise.all([fetchWorkoutSessions(clientId), fetchExerciseList(clientId)])
      .then(([d, ex]) => {
        setDays(Array.isArray(d) ? d : []);
        setExercises(Array.isArray(ex) ? ex : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const months = useMemo(() => {
    const keys = [...new Set(days.map((d) => monthKeyOf(d.date)))].sort().reverse();
    return keys.map((k) => ({ key: k, label: monthLabelOf(k) }));
  }, [days]);

  useEffect(() => {
    if (!selectedMonth && months.length) setSelectedMonth(months[0].key);
  }, [months, selectedMonth]);

  const visibleDays = useMemo(
    () => days.filter((d) => monthKeyOf(d.date) === selectedMonth),
    [days, selectedMonth]
  );

  const back = () => {
    if (activeExercise) return setActiveExercise(null);
    if (showDayDetail) return setShowDayDetail(false);
    if (activeDay) return setActiveDay(null);
  };
  const showBack = !!(activeDay || activeExercise || showDayDetail);
  const headerTitle = activeExercise ? activeExercise.exercise_name
    : activeDay ? (activeDay.day_name || `Day ${activeDay.day_number}`)
    : 'Logbook';

  if (searchOpen) {
    return (
      <LogbookSearch
        exercises={exercises}
        onClose={() => setSearchOpen(false)}
        onPick={(ex) => { setSearchOpen(false); setActiveDay(null); setShowDayDetail(false); setActiveExercise(ex); }}
      />
    );
  }

  return (
    <div className="lb">
      <header className="lb-header">
        {showBack
          ? <button className="lb-header__back" onClick={back} aria-label="Back">‹</button>
          : <span className="lb-header__spacer" />}
        <h2 className="lb-header__title">{headerTitle}</h2>
        <button className="lb-header__search" onClick={() => setSearchOpen(true)} aria-label="Search">⌕</button>
      </header>

      {loading && <p className="lb-msg">Loading…</p>}
      {error && <p className="lb-msg lb-msg--error">{error}</p>}

      {!loading && !error && (
        <>
          {activeExercise && (
            <LogbookExerciseHistory clientId={clientId} exercise={activeExercise} />
          )}

          {!activeExercise && showDayDetail && activeDay && (
            <ClientWorkoutSessionDetail
              clientId={clientId}
              date={activeDay.date}
              programDayId={activeDay.program_day_id}
              dayLabel={activeDay.day_name || `Day ${activeDay.day_number}`}
            />
          )}

          {!activeExercise && !showDayDetail && activeDay && (
            <LogbookDayExercises
              clientId={clientId}
              day={activeDay}
              exercises={exercises}
              onViewDay={() => setShowDayDetail(true)}
              onPickExercise={(ex) => setActiveExercise(ex)}
            />
          )}

          {!activeDay && (
            <>
              <LogbookMonthChips months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
              <LogbookDayList days={visibleDays} onPickDay={setActiveDay} />
            </>
          )}
        </>
      )}
    </div>
  );
}
