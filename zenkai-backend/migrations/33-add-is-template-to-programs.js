'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('programs', 'is_template', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.sequelize.query(
      `UPDATE programs SET is_template = true WHERE user_id IS NULL`
    );
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('programs', 'is_template');
  }
};
