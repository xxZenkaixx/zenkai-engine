// Adds equipment_type, progression fields, and cable setup fields to exercise_instances.
// * Non-destructive — all new columns have safe defaults.
// * equipment_type defaults to 'barbell' so existing rows are not broken.
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'equipment_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'barbell'
    });

    await queryInterface.addColumn('exercise_instances', 'progression_mode', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'progression_value', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'base_stack_weight', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'stack_step_value', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'micro_step_value', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'max_micro_levels', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'current_micro_level', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('exercise_instances', 'cable_unit', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('exercise_instances', 'cable_setup_locked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface) => {
    const cols = [
      'equipment_type',
      'progression_mode',
      'progression_value',
      'base_stack_weight',
      'stack_step_value',
      'micro_step_value',
      'max_micro_levels',
      'current_micro_level',
      'cable_unit',
      'cable_setup_locked'
    ];

    for (const col of cols) {
      await queryInterface.removeColumn('exercise_instances', col);
    }
  }
};
