// * Handles exercise instance CRUD.
// * Validates equipment_type on all writes.
// * Validates custom progression fields — only allowed when type === 'custom'.
// * Validates cable setup fields when cable_setup_locked === true.
'use strict';

const express = require('express');
const router = express.Router();
const { ExerciseInstance, Exercise } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const { getOwnedProgramViaDay, getOwnedProgramViaInstance } = require('../middleware/ownership');

const VALID_TYPES = ['compound', 'accessory', 'custom', 'bodyweight'];
const VALID_EQUIPMENT_TYPES = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const VALID_PROGRESSION_MODES = ['percent', 'absolute'];
const VALID_CABLE_UNITS = ['lb', 'kg'];

// * Validates the full exercise payload — used on create and update.
// * Returns array of { field, error } objects. Empty array = valid.
function validateExercisePayload(body, isUpdate = false) {
  const errors = [];

  // * equipment_type required on create; validated on update if present
  if (!isUpdate || body.hasOwnProperty('equipment_type')) {
    if (!body.equipment_type && !isUpdate && body.type !== 'bodyweight') {
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
router.get('/day/:dayId', protect, async (req, res) => {
  try {
    const chain = await getOwnedProgramViaDay(req, req.params.dayId, 'read');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });
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
router.post('/', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const chain = await getOwnedProgramViaDay(req, req.body.program_day_id, 'write');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });

    const { saveToLibrary, ...rest } = req.body;
    let payload = { ...rest };

    // * Snapshot copy from library when exercise_id is provided.
    // * Library values are defaults; caller-supplied fields override.
    if (payload.exercise_id) {
      const lib = await Exercise.findByPk(payload.exercise_id);
      if (!lib) {
        return res.status(400).json({ field: 'exercise_id', error: 'Library exercise not found.' });
      }

      const snapshot = {
        name:           lib.name,
        type:           lib.type,
        equipment_type: lib.equipment_type,
        body_part:      lib.body_part,
        video_url:      lib.video_url,
        notes:          lib.notes,
        target_sets:    lib.default_target_sets,
        target_reps:    lib.default_target_reps,
      };

      payload = { ...snapshot, ...rest };
    }

    const validationErrors = validateExercisePayload(payload, false);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors, field: validationErrors[0].field, error: validationErrors[0].error });
    }

    const exercise = await ExerciseInstance.create(payload);

    // * Optional save-to-library — only on free-text path (no exercise_id link).
    if ((saveToLibrary === true || saveToLibrary === 'true') && !payload.exercise_id) {
      try {
        const [libRow] = await Exercise.upsert({
          name:                payload.name,
          type:                payload.type,
          equipment_type:      payload.equipment_type,
          body_part:           payload.body_part ?? null,
          video_url:           payload.video_url ?? null,
          notes:               payload.notes ?? null,
          default_target_sets: payload.target_sets ?? null,
          default_target_reps: payload.target_reps ?? null,
          created_by:          req.user?.id,
        });
        if (libRow?.id) {
          await exercise.update({ exercise_id: libRow.id });
        }
      } catch (libErr) {
        console.error('Save-to-library upsert failed:', libErr.message);
      }
    }

    res.status(201).json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * UPDATE exercise
router.put('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const chain = await getOwnedProgramViaInstance(req, req.params.id, 'write');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });
    const { saveToLibrary, ...rest } = req.body;
    const exercise = chain.instance;

    // * Merge existing values with incoming body for validation context
    const merged = { ...exercise.toJSON(), ...rest };
    const validationErrors = validateExercisePayload(merged, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors, field: validationErrors[0].field, error: validationErrors[0].error });
    }

    await exercise.update(rest);

    // * Optional save-to-library on edit — same guard as POST
    if ((saveToLibrary === true || saveToLibrary === 'true') && !merged.exercise_id) {
      try {
        const [libRow] = await Exercise.upsert({
          name:                merged.name,
          type:                merged.type,
          equipment_type:      merged.equipment_type,
          body_part:           merged.body_part ?? null,
          video_url:           merged.video_url ?? null,
          notes:               merged.notes ?? null,
          default_target_sets: merged.target_sets ?? null,
          default_target_reps: merged.target_reps ?? null,
          created_by:          req.user?.id,
        });
        if (libRow?.id) {
          await exercise.update({ exercise_id: libRow.id });
        }
      } catch (libErr) {
        console.error('Save-to-library upsert failed (edit):', libErr.message);
      }
    }

    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * DELETE exercise
router.delete('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const chain = await getOwnedProgramViaInstance(req, req.params.id, 'write');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });
    await chain.instance.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
