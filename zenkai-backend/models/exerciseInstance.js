// ExerciseInstance model.
// * type field added for future progression logic.
// * Valid types: compound | accessory | custom
'use strict';

const { DataTypes } = require('sequelize');

const VALID_TYPES = ['compound', 'accessory', 'custom'];

module.exports = (sequelize) => {
  return sequelize.define(
    'ExerciseInstance',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      program_day_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'accessory',
        validate: {
          isIn: [VALID_TYPES]
        }
      },
      target_sets: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      target_reps: {
        type: DataTypes.STRING,
        allowNull: false
      },
      target_weight: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true
      },
      rest_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      order_index: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      tableName: 'exercise_instances',
      underscored: true
    }
  );
};
