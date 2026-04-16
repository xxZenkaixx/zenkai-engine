'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'backoff_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('exercise_instances', 'backoff_percent', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('exercise_instances', 'backoff_enabled');
    await queryInterface.removeColumn('exercise_instances', 'backoff_percent');
  }
};
