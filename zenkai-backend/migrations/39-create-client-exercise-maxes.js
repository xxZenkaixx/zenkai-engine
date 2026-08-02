'use strict';

// Linear periodization (BBLS 2.0) — Phase 2.
//
// Training 1RM is TRAINER INPUT. It lives in its own table rather than as a
// column on client_exercise_targets for two reasons:
//   1. recomputeTargetAfterDelete destroys whole client_exercise_targets rows
//      when a logged set is deleted — a 1RM there would be silently wiped.
//   2. Everything in client_exercise_targets is system OUTPUT. Mixing trainer
//      input with computed output is what produced the bug where builder edits
//      were overwritten by progression.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('client_exercise_maxes', {
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
      exercise_instance_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'exercise_instances', key: 'id' },
        onDelete: 'CASCADE'
      },
      training_1rm: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      'client_exercise_maxes',
      ['client_program_id', 'exercise_instance_id'],
      { unique: true, name: 'cem_unique_program_exercise' }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('client_exercise_maxes');
  }
};
