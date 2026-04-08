// Seeds default progression rules for compound and accessory exercise types.
// * compound: +3% on progress, -5% on regression
// * accessory: +2% on progress, -5% on regression
'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    await queryInterface.bulkInsert('progression_rules', [
      {
        id: randomUUID(),
        type: 'compound',
        increase_percent: 0.05,
        decrease_percent: 0.05,
        created_at: now,
        updated_at: now
      },
      {
        id: randomUUID(),
        type: 'accessory',
        increase_percent: 0.025,
        decrease_percent: 0.05,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('progression_rules', {
      type: {
        [Sequelize.Op.in]: ['compound', 'accessory']
      }
    });
  }
};
