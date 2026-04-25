'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('logged_sets', 'exercise_note', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('logged_sets', 'exercise_note');
  }
};
