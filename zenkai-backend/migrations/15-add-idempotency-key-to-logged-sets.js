'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('logged_sets', 'idempotency_key', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addIndex('logged_sets', ['idempotency_key'], {
      name: 'logged_sets_idempotency_key_unique',
      unique: true,
      where: { idempotency_key: { [Sequelize.Op.ne]: null } }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex(
      'logged_sets',
      'logged_sets_idempotency_key_unique'
    );
    await queryInterface.removeColumn('logged_sets', 'idempotency_key');
  }
};
