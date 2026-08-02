'use strict';
const { DataTypes } = require('sequelize');

const VALID_PERIODIZATION_ROLES = ['primary', 'secondary', 'accessory'];

module.exports = (sequelize) => {
  return sequelize.define('PeriodizationWeek', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    program_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 16 }
    },
    periodization_role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [VALID_PERIODIZATION_ROLES] }
    },
    // PERCENT, not a fraction: 85 means 85% of the Training 1RM.
    // Null for accessories.
    intensity_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    sets: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // String so it can hold a single value ("6"), a range ("8-10"), or
    // "AMRAP" (week 15) — matching exercise_instances.target_reps.
    reps: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'periodization_weeks',
    underscored: true,
    timestamps: true
  });
};
