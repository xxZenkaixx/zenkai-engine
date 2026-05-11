'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exercises', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: Sequelize.ENUM('compound', 'accessory', 'custom'),
        allowNull: false,
        defaultValue: 'accessory',
      },
      equipment_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      body_part: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      video_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      default_target_sets: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      default_target_reps: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('exercises', ['tenant_id']);
    await queryInterface.addIndex('exercises', ['body_part']);
    await queryInterface.addIndex('exercises', ['equipment_type']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('exercises');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_exercises_type";');
  },
};
