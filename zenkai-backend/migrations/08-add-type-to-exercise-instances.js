// Adds type column to exercise_instances table.
// * Non-destructive — defaults to 'accessory' so existing rows are not broken.
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'accessory'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('exercise_instances', 'type');
  }
};
