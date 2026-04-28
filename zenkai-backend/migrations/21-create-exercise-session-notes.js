'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exercise_session_notes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      exercise_instance_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      program_day_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      session_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex(
      'exercise_session_notes',
      ['client_id', 'exercise_instance_id', 'program_day_id', 'session_date'],
      { unique: true, name: 'exercise_session_notes_unique_key' }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('exercise_session_notes');
  }
};
