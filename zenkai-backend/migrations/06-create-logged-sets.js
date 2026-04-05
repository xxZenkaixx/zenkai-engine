'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('logged_sets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      exercise_instance_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'exercise_instances', key: 'id' },
        onDelete: 'CASCADE'
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'clients', key: 'id' },
        onDelete: 'CASCADE'
      },
      set_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      completed_reps: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
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

    await queryInterface.addIndex(
      'logged_sets',
      ['client_id', 'exercise_instance_id', 'set_number'],
      {
        unique: true,
        name: 'unique_client_exercise_set'
      }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('logged_sets');
  }
};
