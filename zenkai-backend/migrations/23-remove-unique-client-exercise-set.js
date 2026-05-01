'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('logged_sets', 'unique_client_exercise_set');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addIndex('logged_sets', ['client_id', 'exercise_instance_id', 'set_number'], {
      unique: true,
      name: 'unique_client_exercise_set'
    });
  }
};
