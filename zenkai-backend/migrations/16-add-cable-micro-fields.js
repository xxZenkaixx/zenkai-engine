'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'micro_type', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('exercise_instances', 'micro_display_label', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('exercise_instances', 'micro_type');
    await queryInterface.removeColumn('exercise_instances', 'micro_display_label');
  }
};
