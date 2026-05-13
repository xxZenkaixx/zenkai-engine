'use strict';
const { Program, ProgramDay, ExerciseInstance, Client } = require('../models');

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
    // Templates are read-only for self-serve; own programs are fully writable
    if (mode === 'read' && program.is_template) return program;
    return program.user_id === uid ? program : null;
  }
  if (role === 'client' && mode === 'read') {
    return program.is_template || (coach_id && program.user_id === coach_id) ? program : null;
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

// Returns the Client instance if req.user may access it, else null.
// Admins bypass all ownership checks.
// self-serve / client role: client.user_id must match req.user.id.
async function getOwnedClient(req, clientId) {
  if (!clientId) return null;
  const client = await Client.findByPk(clientId);
  if (!client) return null;

  const { role, id: uid } = req.user;

  if (role === 'admin') return client;
  if (role === 'self-serve' || role === 'client') {
    return client.user_id === uid ? client : null;
  }
  return null;
}

module.exports = { getOwnedProgram, getOwnedProgramViaDay, getOwnedProgramViaInstance, getOwnedClient };
