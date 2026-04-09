// Creates the exercise_progressions table.
// * Stores post-workout next target state per exercise instance per client.
// * next_weight is used for non-cable exercises.
// * next_cable_state is used for cable exercises (JSON).
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exercise_progressions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      exercise_instance_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      next_weight: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true
      },
      next_cable_state: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('exercise_progressions');
  }
};