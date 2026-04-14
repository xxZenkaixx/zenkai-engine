// * Dedicated program builder workspace.
// * Full-width focused context for building days and exercises.
// * Reuses ProgramDayList — does not duplicate edit logic.

import ProgramDayList from './ProgramDayList';

export default function ProgramBuilder({ program, onBack }) {
  return (
    <div className="pb-shell">
      <div className="pb-header">
        <button className="pb-back-btn" onClick={onBack}>
          ← Programs
        </button>
        <div className="pb-header__info">
          <h2 className="pb-header__name">{program.name}</h2>
          <span className="pb-header__meta">{program.weeks} weeks</span>
        </div>
      </div>
      <div className="pb-workspace">
        <ProgramDayList programId={program.id} />
      </div>
    </div>
  );
}
