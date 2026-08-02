'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ClientDayCompletion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    client_program_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    program_day_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },
    // Client-generated draft session id. Traceability only — row identity comes
    // from the unique constraint, not from this.
    session_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'client_day_completions',
    underscored: true,
    timestamps: true
  });
};
