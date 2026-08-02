'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ClientExerciseMax', {
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
    // Trainer input, never computed. Null = not yet tested/entered.
    training_1rm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    }
  }, {
    tableName: 'client_exercise_maxes',
    underscored: true,
    timestamps: true
  });
};
