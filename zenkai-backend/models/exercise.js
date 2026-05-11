'use strict';

const { DataTypes } = require('sequelize');

const VALID_TYPES = ['compound', 'accessory', 'custom'];

module.exports = (sequelize) => {
  return sequelize.define(
    'Exercise',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: DataTypes.ENUM(...VALID_TYPES),
        allowNull: false,
        defaultValue: 'accessory',
      },
      equipment_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body_part: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      video_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      default_target_sets: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      default_target_reps: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      tenant_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName:   'exercises',
      underscored: true,
      timestamps:  true,
    }
  );
};
