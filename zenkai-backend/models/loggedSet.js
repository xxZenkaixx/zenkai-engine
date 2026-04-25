'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('LoggedSet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    exercise_instance_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    client_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    set_number: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    completed_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    },
    completed_reps: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    idempotency_key: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    exercise_note: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'logged_sets',
    underscored: true,
    timestamps: true
  });
};
