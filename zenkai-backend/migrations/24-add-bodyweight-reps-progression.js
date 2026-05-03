'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('exercise_progressions', 'next_target_reps', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('client_exercise_targets', 'target_reps', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('exercise_progressions', 'next_target_reps');
    await queryInterface.removeColumn('client_exercise_targets', 'target_reps');
  }
};
