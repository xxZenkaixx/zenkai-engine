'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('client_exercise_targets', {
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
      target_weight: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true
      },
      cable_state: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      'client_exercise_targets',
      ['client_program_id', 'exercise_instance_id'],
      { unique: true, name: 'cet_unique_program_exercise' }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('client_exercise_targets');
  }
};
