'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ClientExerciseTarget', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    client_program_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    exercise_instance_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    target_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    },
    cable_state: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'client_exercise_targets',
    underscored: true,
    timestamps: true
  });
};
