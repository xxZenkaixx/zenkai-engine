'use strict';
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const Client = require('./client')(sequelize);
const Program = require('./program')(sequelize);
const ProgramDay = require('./programDay')(sequelize);
const ExerciseInstance = require('./exerciseInstance')(sequelize);
const ClientProgram = require('./clientProgram')(sequelize);
const LoggedSet = require('./loggedSet')(sequelize);
const ProgressionRule = require('./progressionRule')(sequelize);
const ExerciseProgression = require('./exerciseProgression')(sequelize);
const ClientExerciseTarget = require('./clientExerciseTarget')(sequelize);

/* Associations */

Client.hasMany(ClientProgram, { foreignKey: 'client_id' });
ClientProgram.belongsTo(Client, { foreignKey: 'client_id' });

Program.hasMany(ClientProgram, { foreignKey: 'program_id' });
ClientProgram.belongsTo(Program, { foreignKey: 'program_id' });

Program.hasMany(ProgramDay, { foreignKey: 'program_id' });
ProgramDay.belongsTo(Program, { foreignKey: 'program_id' });

ProgramDay.hasMany(ExerciseInstance, { foreignKey: 'program_day_id' });
ExerciseInstance.belongsTo(ProgramDay, { foreignKey: 'program_day_id' });

ExerciseInstance.hasMany(LoggedSet, { foreignKey: 'exercise_instance_id' });
LoggedSet.belongsTo(ExerciseInstance, { foreignKey: 'exercise_instance_id' });

Client.hasMany(LoggedSet, { foreignKey: 'client_id' });
LoggedSet.belongsTo(Client, { foreignKey: 'client_id' });

ClientProgram.hasMany(ClientExerciseTarget, { foreignKey: 'client_program_id' });
ClientExerciseTarget.belongsTo(ClientProgram, { foreignKey: 'client_program_id' });

ExerciseInstance.hasMany(ClientExerciseTarget, { foreignKey: 'exercise_instance_id' });
ClientExerciseTarget.belongsTo(ExerciseInstance, { foreignKey: 'exercise_instance_id' });

module.exports = {
  sequelize,
  Client,
  Program,
  ProgramDay,
  ExerciseInstance,
  ClientProgram,
  LoggedSet,
  ProgressionRule,
  ExerciseProgression,
  ClientExerciseTarget
};
