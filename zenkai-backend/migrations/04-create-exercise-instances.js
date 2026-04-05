'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exercise_instances', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      program_day_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'program_days', key: 'id' },
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      target_sets: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      target_reps: {
        type: Sequelize.STRING,
        allowNull: false
      },
      target_weight: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true
      },
      rest_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('exercise_instances');
  }
};
