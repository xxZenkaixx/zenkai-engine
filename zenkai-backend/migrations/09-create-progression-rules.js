// Creates the progression_rules table.
// * One row per exercise type: compound, accessory.
// * custom exercises are excluded from this table entirely.
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('progression_rules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      increase_percent: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      decrease_percent: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('progression_rules');
  }
};
