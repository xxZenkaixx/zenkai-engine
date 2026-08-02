'use strict';

// Linear periodization (BBLS 2.0) — Phase 3.
//
// One row per (program, week, role). 48 rows for a full 16-week macrocycle.
// Keyed by program_id because programs are cloned per client — each clone needs
// its own schedule. NOTE: the clone endpoint does NOT copy these rows yet;
// that's Phase 7 and it is mandatory.
//
// intensity_pct is a PERCENT (85), not a fraction. Null for accessories, which
// keep their existing weight progression and take only a rep schedule.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('periodization_weeks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      program_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'programs', key: 'id' },
        onDelete: 'CASCADE'
      },
      week_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      periodization_role: {
        type: Sequelize.STRING,
        allowNull: false
      },
      intensity_pct: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      sets: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reps: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      'periodization_weeks',
      ['program_id', 'week_number', 'periodization_role'],
      { unique: true, name: 'pw_unique_program_week_role' }
    );

    // v1 is one 16-week macrocycle. This CHECK is the scope boundary — drop it
    // in the migration that introduces multi-cycle support.
    await queryInterface.sequelize.query(`
      ALTER TABLE periodization_weeks
      ADD CONSTRAINT pw_week_number_range
      CHECK (week_number BETWEEN 1 AND 16)
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE periodization_weeks
      ADD CONSTRAINT pw_valid_role
      CHECK (periodization_role IN ('primary', 'secondary', 'accessory'))
    `);

    // A primary/secondary row missing intensity or sets would silently yield a
    // null prescribed weight in Phase 5. Reject it at write time instead.
    await queryInterface.sequelize.query(`
      ALTER TABLE periodization_weeks
      ADD CONSTRAINT pw_periodized_rows_complete
      CHECK (
        periodization_role = 'accessory'
        OR (intensity_pct IS NOT NULL AND sets IS NOT NULL)
      )
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('periodization_weeks');
  }
};
