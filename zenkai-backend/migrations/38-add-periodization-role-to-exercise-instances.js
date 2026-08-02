'use strict';

// Linear periodization (BBLS 2.0) — Phase 1.
//
// Role is INSTANCE-level, not library-level: the same lift is primary in one
// program and accessory in another.
//
// Deliberately NOT folded into the existing `type` column, which already has an
// 'accessory' value meaning something entirely different — it drives the
// progression_rules lookup and the bodyweight/isometric branches.
//
// NOT NULL + default 'accessory' means every existing row keeps today's exact
// behavior. Nothing reads this column until Phase 5.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'periodization_role', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'accessory'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('exercise_instances', 'periodization_role');
  }
};
