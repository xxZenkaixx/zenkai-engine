'use strict';
const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.RENDER === 'true';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

const User = require('./user')(sequelize);
const Client = require('./client')(sequelize);
const Program = require('./program')(sequelize);
const ProgramDay = require('./programDay')(sequelize);
const ExerciseInstance = require('./exerciseInstance')(sequelize);
const ClientProgram = require('./clientProgram')(sequelize);
const LoggedSet = require('./loggedSet')(sequelize);
const ProgressionRule = require('./progressionRule')(sequelize);
const ExerciseProgression = require('./exerciseProgression')(sequelize);
const ClientExerciseTarget = require('./clientExerciseTarget')(sequelize);
const ExerciseSessionNote = require('./exerciseSessionNote')(sequelize);
const Exercise = require('./exercise')(sequelize);

/* Associations */

User.hasMany(Program, { foreignKey: 'user_id' });
Program.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Client, { foreignKey: 'coach_id', as: 'Clients' });
Client.belongsTo(User, { foreignKey: 'coach_id', as: 'Coach' });
User.hasOne(Client, { foreignKey: 'user_id', as: 'ClientRecord' });
Client.belongsTo(User, { foreignKey: 'user_id', as: 'ClientUser' });

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

User.hasMany(Exercise, { foreignKey: 'created_by', as: 'CreatedExercises' });
Exercise.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });

module.exports = {
  sequelize,
  User,
  Client,
  Program,
  ProgramDay,
  ExerciseInstance,
  ClientProgram,
  LoggedSet,
  ProgressionRule,
  ExerciseProgression,
  ClientExerciseTarget,
  ExerciseSessionNote,
  Exercise,
};
