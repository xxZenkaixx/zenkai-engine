'use strict';

// Linear periodization (BBLS 2.0) — Phase 4.
//
// An explicit record that a client finished a given program day in a given
// week. This exists because nothing in the schema previously recorded workout
// completion — history INFERS a session by grouping logged_sets by date and
// program day, which has no week dimension and would silently un-complete a
// day if a set were ever deleted.
//
// Completion is an EVENT, not derived state. Deleting a logged set must never
// remove one of these rows.
//
// The unique constraint is what makes the finish endpoint idempotent: repeating
// a day inside the same week is absorbed, so it can neither double-count nor
// push a client forward early. Its leading column is client_program_id, so it
// also serves the "how many days done this week" count without a second index.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('client_day_completions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      client_program_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_programs', key: 'id' },
        onDelete: 'CASCADE'
      },
      program_day_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'program_days', key: 'id' },
        onDelete: 'CASCADE'
      },
      week_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      // The client-generated session id from the workout draft. Traceability
      // only — identity comes from the unique constraint below, not from this.
      session_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      'client_day_completions',
      ['client_program_id', 'program_day_id', 'week_number'],
      { unique: true, name: 'cdc_unique_program_day_week' }
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE client_day_completions
      ADD CONSTRAINT cdc_week_number_positive
      CHECK (week_number >= 1)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('client_day_completions');
  }
};
