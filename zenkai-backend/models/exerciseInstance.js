// ExerciseInstance model.
// * type field: compound | accessory | custom
// * equipment_type field: barbell | dumbbell | machine | cable
// * Cable setup fields are nullable for non-cable exercises.
// * cable_setup_locked prevents client from re-editing after first save.
'use strict';

const { DataTypes } = require('sequelize');

const VALID_TYPES = ['compound', 'accessory', 'custom', 'bodyweight'];
const VALID_EQUIPMENT_TYPES = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const VALID_CABLE_UNITS = ['lb', 'kg'];
const VALID_PROGRESSION_MODES = ['percent', 'absolute'];

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
      equipment_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'barbell',
        validate: {
          isIn: [VALID_EQUIPMENT_TYPES]
        }
      },
      // * Only populated when type === 'custom'
      progression_mode: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isIn: [[...VALID_PROGRESSION_MODES, null]]
        }
      },
      progression_value: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      target_sets: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      target_reps: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // * General programmed weight — not the cable display weight
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
      },
      video_url: {
        type: DataTypes.STRING,
        allowNull: true
      },

      // * Cable-only fields — null for all other equipment types
      base_stack_weight: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      stack_step_value: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      micro_step_value: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      max_micro_levels: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      current_micro_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      cable_unit: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isIn: [[...VALID_CABLE_UNITS, null]]
        }
      },
      cable_setup_locked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      micro_type: {
        type: DataTypes.STRING,
        allowNull: true
      },
      micro_display_label: {
        type: DataTypes.STRING,
        allowNull: true
      },
      backoff_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      backoff_percent: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: 'exercise_instances',
      underscored: true
    }
  );
};
