'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'client', 'self-serve'),
      allowNull: false,
      defaultValue: 'self-serve'
    },
    coach_id: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true
  });
};
