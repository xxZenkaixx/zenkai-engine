// Canonical BBLS 2.0 16-week linear periodization schedule.
//
// Values supplied by the program author — do not adjust them without being told.
//
// intensity_pct is a PERCENT (85 = 85% of Training 1RM), null for accessories.
// Accessories carry a rep schedule only; their weight stays owned by the
// existing set-by-set progression.
//
// Primary and Secondary run the IDENTICAL schedule. They are still stored as
// separate rows (48 total) so the two can diverge later without a migration.
//
// Week 15 reps is 'AMRAP' — a deliberate non-numeric target. Anything that
// parses reps numerically must tolerate it; for primary/secondary that's moot
// because set-by-set progression is suppressed for those roles (Phase 6).
'use strict';

const SCHEDULE = [
  { week_number: 1,  intensity_pct: 70, sets: 4, reps: '10' },
  { week_number: 2,  intensity_pct: 75, sets: 4, reps: '8' },
  { week_number: 3,  intensity_pct: 80, sets: 4, reps: '6' },
  { week_number: 4,  intensity_pct: 80, sets: 2, reps: '3' },
  { week_number: 5,  intensity_pct: 75, sets: 4, reps: '8' },
  { week_number: 6,  intensity_pct: 80, sets: 4, reps: '6' },
  { week_number: 7,  intensity_pct: 85, sets: 4, reps: '4' },
  { week_number: 8,  intensity_pct: 85, sets: 2, reps: '2' },
  { week_number: 9,  intensity_pct: 80, sets: 4, reps: '6' },
  { week_number: 10, intensity_pct: 85, sets: 4, reps: '4' },
  { week_number: 11, intensity_pct: 90, sets: 4, reps: '2' },
  { week_number: 12, intensity_pct: 90, sets: 2, reps: '1' },
  { week_number: 13, intensity_pct: 85, sets: 4, reps: '4' },
  { week_number: 14, intensity_pct: 90, sets: 4, reps: '2' },
  { week_number: 15, intensity_pct: 95, sets: 1, reps: 'AMRAP' },
  { week_number: 16, intensity_pct: 50, sets: 2, reps: '5' },
];

// Uniform across all accessories, per the agreed (program, week, role) key.
const ACCESSORY_PHASES = [
  { weeks: [1, 2, 3, 4],                     reps: '10-12' },
  { weeks: [5, 6, 7, 8, 9, 10, 11, 12],      reps: '8-10' },
  { weeks: [13, 14, 15, 16],                 reps: '6-8' },
];

const ACCESSORY = ACCESSORY_PHASES.flatMap(({ weeks, reps }) =>
  weeks.map((week_number) => ({
    week_number,
    intensity_pct: null,
    sets: null,
    reps
  }))
);

// Flat 48-row list, role tagged. Order is stable for readable diffs.
const BBLS2_WEEKS = [
  ...SCHEDULE.map((r) => ({ ...r, periodization_role: 'primary' })),
  ...SCHEDULE.map((r) => ({ ...r, periodization_role: 'secondary' })),
  ...ACCESSORY.map((r) => ({ ...r, periodization_role: 'accessory' })),
];

const TOTAL_WEEKS = 16;

module.exports = { BBLS2_WEEKS, TOTAL_WEEKS, SCHEDULE, ACCESSORY };
