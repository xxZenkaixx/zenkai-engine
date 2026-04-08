// ProgressionRule model.
// * Stores increase/decrease percentages per exercise type.
// * custom exercises do NOT use this table.
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define(
    'ProgressionRule',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isIn: [['compound', 'accessory']]
        }
      },
      increase_percent: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      decrease_percent: {
        type: DataTypes.FLOAT,
        allowNull: false
      }
    },
    {
      tableName: 'progression_rules',
      underscored: true
    }
  );
};
