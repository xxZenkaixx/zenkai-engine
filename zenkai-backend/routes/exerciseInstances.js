// * Handles exercise instance CRUD.
// * Validates equipment_type on all writes.
// * Validates custom progression fields — only allowed when type === 'custom'.
// * Validates cable setup fields when cable_setup_locked === true.
'use strict';

const express = require('express');
const router = express.Router();
const { ExerciseInstance } = require('../models');

const VALID_TYPES = ['compound', 'accessory', 'custom'];
const VALID_EQUIPMENT_TYPES = ['barbell', 'dumbbell', 'machine', 'cable'];
const VALID_PROGRESSION_MODES = ['percent', 'absolute'];
const VALID_CABLE_UNITS = ['lb', 'kg'];

// * Validates the full exercise payload — used on create and update.
// * Returns array of { field, error } objects. Empty array = valid.
function validateExercisePayload(body, isUpdate = false) {
  const errors = [];

  // * equipment_type required on create; validated on update if present
  if (!isUpdate || body.hasOwnProperty('equipment_type')) {
    if (!body.equipment_type && !isUpdate) {
      errors.push({ field: 'equipment_type', error: 'Equipment type is required.' });
    } else if (body.equipment_type && !VALID_EQUIPMENT_TYPES.includes(body.equipment_type)) {
      errors.push({ field: 'equipment_type', error: 'Invalid equipment type.' });
    }
  }

  // * type validated if present
  if (body.hasOwnProperty('type')) {
    if (!body.type) {
      errors.push({ field: 'type', error: 'Exercise type is required.' });
    } else if (!VALID_TYPES.includes(body.type)) {
      errors.push({ field: 'type', error: 'Invalid exercise type.' });
    }
  }

  const effectiveType = body.type;

  // * custom requires progression_mode + progression_value
  // * non-custom must NOT have them
  if (effectiveType === 'custom') {
    if (!body.progression_mode || !VALID_PROGRESSION_MODES.includes(body.progression_mode)) {
      errors.push({ field: 'progression_mode', error: 'Custom exercises require a valid progression mode (percent or absolute).' });
    }
    if (body.progression_value == null || isNaN(Number(body.progression_value))) {
      errors.push({ field: 'progression_value', error: 'Custom exercises require a progression value.' });
    }
  } else if (effectiveType && effectiveType !== 'custom') {
    if (body.progression_mode != null) {
      errors.push({ field: 'progression_mode', error: 'progression_mode is only allowed on custom exercises.' });
    }
    if (body.progression_value != null) {
      errors.push({ field: 'progression_value', error: 'progression_value is only allowed on custom exercises.' });
    }
  }

  // * Cable locked setup validation — UPDATED for new cable logic
  const isCable = body.equipment_type === 'cable';
  const isLocked = body.cable_setup_locked === true;

  if (isCable && isLocked) {
    if (body.base_stack_weight == null)
      errors.push({ field: 'base_stack_weight', error: 'base_stack_weight required when cable setup is locked.' });

    if (body.stack_step_value == null)
      errors.push({ field: 'stack_step_value', error: 'stack_step_value required when cable setup is locked.' });

    if (body.max_micro_levels == null || !Number.isInteger(Number(body.max_micro_levels)) || Number(body.max_micro_levels) < 0) {
      errors.push({ field: 'max_micro_levels', error: 'max_micro_levels must be a non-negative integer.' });
    }

    if (!body.cable_unit || !VALID_CABLE_UNITS.includes(body.cable_unit)) {
      errors.push({ field: 'cable_unit', error: 'cable_unit must be lb or kg.' });
    }

    if (body.current_micro_level == null || !Number.isInteger(Number(body.current_micro_level)) || Number(body.current_micro_level) < 0) {
      errors.push({ field: 'current_micro_level', error: 'current_micro_level must be a non-negative integer.' });
    }

    // New fields we added
    if (!body.micro_type) {
      errors.push({ field: 'micro_type', error: 'micro_type is required for cable exercises (slider or knob).' });
    }
  }

  return errors;
}

// * GET exercises for a specific day
router.get('/day/:dayId', async (req, res) => {
  try {
    const exercises = await ExerciseInstance.findAll({
      where: { program_day_id: req.params.dayId },
      order: [['order_index', 'ASC']]
    });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * CREATE exercise
router.post('/', async (req, res) => {
  const validationErrors = validateExercisePayload(req.body, false);
  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors, field: validationErrors[0].field, error: validationErrors[0].error });
  }

  try {
    const exercise = await ExerciseInstance.create(req.body);
    res.status(201).json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * UPDATE exercise
router.put('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    // * Merge existing values with incoming body for validation context
    const merged = { ...exercise.toJSON(), ...req.body };
    const validationErrors = validateExercisePayload(merged, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors, field: validationErrors[0].field, error: validationErrors[0].error });
    }

    await exercise.update(req.body);
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * DELETE exercise
router.delete('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    await exercise.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
