'use strict';

// Linear periodization (BBLS 2.0) — Phase 4.
//
// The client's position in the macrocycle. Advanced by completion, never by
// date: see client_day_completions and weekProgressionService.
//
// Default 1 + NOT NULL means every existing assignment starts at week 1.
// Nothing reads this column until Phase 5, so that is inert — but note that
// clients already mid-program will need their week set manually before the
// merge layer lands.
//
// No upper-bound CHECK: the ceiling is programs.weeks, which varies per row and
// can't be expressed as a static constraint. The service enforces it.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('client_programs', 'current_week', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE client_programs
      ADD CONSTRAINT cp_current_week_positive
      CHECK (current_week >= 1)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE client_programs
      DROP CONSTRAINT IF EXISTS cp_current_week_positive
    `);
    await queryInterface.removeColumn('client_programs', 'current_week');
  }
};
