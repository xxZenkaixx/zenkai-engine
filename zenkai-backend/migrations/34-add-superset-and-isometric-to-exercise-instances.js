'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('exercise_instances', 'superset_group_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addColumn('exercise_instances', 'superset_order', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addIndex('exercise_instances', ['superset_group_id'], {
      name: 'exercise_instances_superset_group_id_idx'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('exercise_instances', 'exercise_instances_superset_group_id_idx');
    await queryInterface.removeColumn('exercise_instances', 'superset_order');
    await queryInterface.removeColumn('exercise_instances', 'superset_group_id');
  }
};
