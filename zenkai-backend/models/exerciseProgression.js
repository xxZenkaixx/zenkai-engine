// ExerciseProgression model.
// * Stores the computed next target for an exercise instance after workout evaluation.
// * next_weight used for non-cable exercises.
// * next_cable_state used for cable exercises.
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define(
    'ExerciseProgression',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      client_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      exercise_instance_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      next_weight: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true
      },
      next_cable_state: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'exercise_progressions',
      underscored: true,
      timestamps: true
    }
  );
};