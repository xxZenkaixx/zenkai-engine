'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'first_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'first_name');
  }
};
