'use strict';
const { Program, ProgramDay, ExerciseInstance } = require('../models');

// Returns the Program instance if req.user may access it, else null.
// Admins always pass through (single-operator app — see feedback_admin_bypass_ownership).
// mode 'write' — self-serve must own.
// mode 'read'  — self-serve must own; clients may read their coach's programs.
async function getOwnedProgram(req, programId, mode = 'write') {
  if (!programId) return null;
  const program = await Program.findByPk(programId);
  if (!program) return null;

  const { role, id: uid, coach_id } = req.user;

  // Admins bypass all ownership checks
  if (role === 'admin') return program;

  if (role === 'self-serve') {
    return program.user_id === uid ? program : null;
  }
  if (role === 'client' && mode === 'read') {
    return coach_id && program.user_id === coach_id ? program : null;
  }
  return null;
}

// Resolve program from a program_day_id, then check ownership.
async function getOwnedProgramViaDay(req, dayId, mode = 'write') {
  if (!dayId) return null;
  const day = await ProgramDay.findByPk(dayId, { attributes: ['id', 'program_id'] });
  if (!day) return null;
  const program = await getOwnedProgram(req, day.program_id, mode);
  return program ? { program, day } : null;
}

// Resolve program from an exercise_instance_id, then check ownership.
async function getOwnedProgramViaInstance(req, instanceId, mode = 'write') {
  if (!instanceId) return null;
  const inst = await ExerciseInstance.findByPk(instanceId);
  if (!inst) return null;
  const chain = await getOwnedProgramViaDay(req, inst.program_day_id, mode);
  return chain ? { ...chain, instance: inst } : null;
}

module.exports = { getOwnedProgram, getOwnedProgramViaDay, getOwnedProgramViaInstance };
