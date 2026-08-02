'use strict';

// Seeds the BBLS 2.0 16-week schedule for ONE program.
//
// Deliberately a NO-OP unless a target is named — periodization_weeks is
// per-program, and seeding every program would silently turn them all into
// periodized programs.
//
// Usage:
//   PERIODIZATION_PROGRAM_ID=<uuid>       npx sequelize-cli db:seed --seed 20260802-seed-bbls2-periodization.js
//   PERIODIZATION_PROGRAM_NAME="BBLS 2.0" npx sequelize-cli db:seed --seed 20260802-seed-bbls2-periodization.js
//
// Idempotent: re-running skips rows that already exist.

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');
const { BBLS2_WEEKS } = require('../services/bbls2Template');

async function resolveProgram(queryInterface) {
  const { sequelize } = queryInterface;

  const id = process.env.PERIODIZATION_PROGRAM_ID;
  const name = process.env.PERIODIZATION_PROGRAM_NAME;

  if (id) {
    const rows = await sequelize.query(
      'SELECT id, name FROM programs WHERE id = :id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new Error(`No program with id ${id}`);
    return rows[0];
  }

  if (name) {
    const rows = await sequelize.query(
      'SELECT id, name FROM programs WHERE name = :name',
      { replacements: { name }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new Error(`No program named "${name}"`);
    if (rows.length > 1) {
      throw new Error(
        `${rows.length} programs named "${name}" — pass PERIODIZATION_PROGRAM_ID instead`
      );
    }
    return rows[0];
  }

  return null;
}

module.exports = {
  up: async (queryInterface) => {
    const program = await resolveProgram(queryInterface);
    if (!program) {
      console.log(
        '[BBLS2 seed] No target program. Set PERIODIZATION_PROGRAM_ID or ' +
        'PERIODIZATION_PROGRAM_NAME to seed. Skipping.'
      );
      return;
    }

    const now = new Date();
    const rows = BBLS2_WEEKS.map((w) => ({
      id: randomUUID(),
      program_id: program.id,
      week_number: w.week_number,
      periodization_role: w.periodization_role,
      intensity_pct: w.intensity_pct,
      sets: w.sets,
      reps: w.reps,
      created_at: now,
      updated_at: now
    }));

    // ignoreDuplicates leans on pw_unique_program_week_role, so a partial
    // previous run tops up rather than erroring.
    await queryInterface.bulkInsert('periodization_weeks', rows, {
      ignoreDuplicates: true
    });

    console.log(
      `[BBLS2 seed] Seeded ${rows.length} rows for "${program.name}" (${program.id})`
    );
  },

  down: async (queryInterface) => {
    const program = await resolveProgram(queryInterface);
    if (!program) {
      console.log('[BBLS2 seed] No target program. Skipping.');
      return;
    }
    await queryInterface.bulkDelete('periodization_weeks', {
      program_id: program.id
    });
  }
};
