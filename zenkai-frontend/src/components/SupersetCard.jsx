// SupersetCard.jsx
// Unified 2-exercise (A+B) superset card with reliable interleaving.
// Local activeSide state is the single source of truth for which side
// can log next. A→B passes rest=0 to parent (skip timer, scroll only);
// B→A passes through the real rest so the round-rest timer fires.

import { useEffect, useState } from 'react';
import ExerciseCard from './ExerciseCard';
import './SupersetCard.css';

export default function SupersetCard({
  unit,
  clientId,
  programDayId,
  onSetLogged,
  onExerciseUpdated,
  onLoggedSetsChange,
  onSessionSetsChange,
  loggedCounts,
  cardRefs,
  nextSetRefs,
  restTimerActive,
  restTimerExerciseId,
  restTimerRemaining,
  draftSetsByExId,
  sessionId,
  sessionOverrides,
  onSessionOverrideChange,
  incompleteExerciseIds,
}) {
  const [a, b] = unit.exercises;
  const aTarget = a.target_sets ?? 0;
  const bTarget = b.target_sets ?? 0;

  // Local counts — seeded from parent (handles draft restore), then owned by us.
  const [aLogged, setALogged] = useState(loggedCounts[a.id] ?? 0);
  const [bLogged, setBLogged] = useState(loggedCounts[b.id] ?? 0);

  // Sync from parent if loggedCounts changes externally (draft restore, refresh, etc.)
  useEffect(() => {
    setALogged(loggedCounts[a.id] ?? 0);
    setBLogged(loggedCounts[b.id] ?? 0);
  }, [loggedCounts, a.id, b.id]);

  const aDone = aLogged >= aTarget;
  const bDone = bLogged >= bTarget;

  // Active side — explicit state, flipped only in handleA/handleB.
  // Initial pick: side that's behind (tie → A, both done → null).
  const [activeSide, setActiveSide] = useState(() => {
    if (!aDone && aLogged <= bLogged) return 'A';
    if (!bDone) return 'B';
    return null;
  });

  // One round = one A + one B (floor on the slower side).
  const totalRounds = Math.max(aTarget, bTarget);
  const displayRound = Math.min(Math.min(aLogged, bLogged) + 1, totalRounds);

  // A logs → bump A, pick next active, signal parent.
  //   B still has work → flip to B, skip rest (rest=0).
  //   B done, A still has work → solo A continues, pass real rest.
  //   Both done → null.
  const handleA = (rest, exId) => {
    const next = aLogged + 1;
    setALogged(next);
    if (bLogged < bTarget) {
      setActiveSide('B');
      onSetLogged(0, exId);
    } else if (next < aTarget) {
      setActiveSide('A');
      onSetLogged(rest, exId);
    } else {
      setActiveSide(null);
      onSetLogged(rest, exId);
    }
  };

  // B logs → bump B, flip back to A (unless A is done). Rest always passes through.
  const handleB = (rest, exId) => {
    const next = bLogged + 1;
    setBLogged(next);
    if (aLogged < aTarget) setActiveSide('A');
    else if (next < bTarget) setActiveSide('B');
    else setActiveSide(null);
    onSetLogged(rest, exId);
  };

  const sideClass = (side, done) => {
    if (done) return 'sc-side sc-side--done';
    if (activeSide === side) return 'sc-side sc-side--active';
    return 'sc-side sc-side--waiting';
  };

  const aIsLast = incompleteExerciseIds.size === 1 && incompleteExerciseIds.has(a.id);
  const bIsLast = incompleteExerciseIds.size === 1 && incompleteExerciseIds.has(b.id);

  return (
    <div
      className="sc-card"
      ref={(el) => { cardRefs.current[unit.groupId] = el; }}
    >
      <div className="sc-card__header">
        <span className="sc-card__label">⚡ SUPER</span>
        <span className="sc-card__title">{a.name} + {b.name}</span>
        <span className="sc-card__rounds">Round {displayRound} of {totalRounds}</span>
      </div>

      <div className={sideClass('A', aDone)}>
        <div className="sc-side__badge sc-side__badge--a">A</div>
        {activeSide !== 'A' && !aDone && (
          <div className="sc-side__hint">Waiting — log B first</div>
        )}
        <ExerciseCard
          exercise={a}
          clientId={clientId}
          programDayId={programDayId}
          onSetLogged={handleA}
          onExerciseUpdated={onExerciseUpdated}
          onLoggedSetsChange={onLoggedSetsChange}
          onSessionSetsChange={onSessionSetsChange}
          isLastIncomplete={aIsLast}
          cardRef={(el)    => { cardRefs.current[a.id]    = el; }}
          nextSetRef={(el) => { nextSetRefs.current[a.id] = el; }}
          restTimerActive={restTimerActive && restTimerExerciseId === a.id}
          restTimerRemaining={restTimerRemaining}
          initialSets={draftSetsByExId[a.id] || []}
          sessionId={sessionId}
          onSkip={null}
          sessionOverride={sessionOverrides[a.id] ?? null}
          onSessionOverrideChange={(o) => onSessionOverrideChange(a.id, o)}
        />
      </div>

      <div className={sideClass('B', bDone)}>
        <div className="sc-side__badge sc-side__badge--b">B</div>
        {activeSide !== 'B' && !bDone && (
          <div className="sc-side__hint">Waiting — log A first</div>
        )}
        <ExerciseCard
          exercise={b}
          clientId={clientId}
          programDayId={programDayId}
          onSetLogged={handleB}
          onExerciseUpdated={onExerciseUpdated}
          onLoggedSetsChange={onLoggedSetsChange}
          onSessionSetsChange={onSessionSetsChange}
          isLastIncomplete={bIsLast}
          cardRef={(el)    => { cardRefs.current[b.id]    = el; }}
          nextSetRef={(el) => { nextSetRefs.current[b.id] = el; }}
          restTimerActive={restTimerActive && restTimerExerciseId === b.id}
          restTimerRemaining={restTimerRemaining}
          initialSets={draftSetsByExId[b.id] || []}
          sessionId={sessionId}
          onSkip={null}
          sessionOverride={sessionOverrides[b.id] ?? null}
          onSessionOverrideChange={(o) => onSessionOverrideChange(b.id, o)}
        />
      </div>
    </div>
  );
}
