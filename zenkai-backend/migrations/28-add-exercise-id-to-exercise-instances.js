'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'exercise_id', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'exercises', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('exercise_instances', ['exercise_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('exercise_instances', ['exercise_id']);
    await queryInterface.removeColumn('exercise_instances', 'exercise_id');
  },
};
