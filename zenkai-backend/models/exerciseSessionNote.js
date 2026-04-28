'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ExerciseSessionNote', {
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
    program_day_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    session_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'exercise_session_notes',
    underscored: true,
    timestamps: true
  });
};
