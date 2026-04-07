'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('logged_sets', 'completed_weight', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('logged_sets', 'completed_weight');
  }
};
