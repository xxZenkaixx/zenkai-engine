// Adds applied_at to exercise_progressions.
// * Marks when a progression row has been consumed by the mutation layer.
// * Nullable — null means unapplied, timestamp means already applied.
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_progressions', 'applied_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('exercise_progressions', 'applied_at');
  }
};
