'use strict';

const { randomUUID } = require('crypto');

const exercises = [
  {
    name:                 'Barbell Back Squat',
    type:                 'compound',
    equipment_type:       'barbell',
    body_part:            'legs',
    default_target_sets:  4,
    default_target_reps:  '5',
    notes:                'Brace core, knees track over toes, hip crease below parallel.',
  },
  {
    name:                 'Barbell Bench Press',
    type:                 'compound',
    equipment_type:       'barbell',
    body_part:            'chest',
    default_target_sets:  4,
    default_target_reps:  '5',
    notes:                'Retract scapula, bar touches lower chest, controlled descent.',
  },
  {
    name:                 'Barbell Deadlift',
    type:                 'compound',
    equipment_type:       'barbell',
    body_part:            'back',
    default_target_sets:  3,
    default_target_reps:  '5',
    notes:                'Neutral spine, bar stays over mid-foot throughout the pull.',
  },
  {
    name:                 'Barbell Bent-Over Row',
    type:                 'compound',
    equipment_type:       'barbell',
    body_part:            'back',
    default_target_sets:  4,
    default_target_reps:  '8',
    notes:                'Hinge to ~45°, pull bar to lower chest, squeeze at top.',
  },
  {
    name:                 'Barbell Overhead Press',
    type:                 'compound',
    equipment_type:       'barbell',
    body_part:            'shoulders',
    default_target_sets:  4,
    default_target_reps:  '5',
    notes:                'Press bar vertically, tuck chin on ascent, lockout overhead.',
  },
  {
    name:                 'Pull-Up',
    type:                 'compound',
    equipment_type:       'bodyweight',
    body_part:            'back',
    default_target_sets:  4,
    default_target_reps:  '8',
    notes:                'Full dead hang at bottom, chin clears bar at top.',
  },
  {
    name:                 'Dumbbell Romanian Deadlift',
    type:                 'accessory',
    equipment_type:       'dumbbell',
    body_part:            'hamstrings',
    default_target_sets:  3,
    default_target_reps:  '10-12',
    notes:                'Soft knee bend, push hips back, feel hamstring stretch before reversing.',
  },
  {
    name:                 'Dumbbell Lateral Raise',
    type:                 'accessory',
    equipment_type:       'dumbbell',
    body_part:            'shoulders',
    default_target_sets:  3,
    default_target_reps:  '12-15',
    notes:                'Slight forward lean, lead with elbows, avoid shrugging.',
  },
  {
    name:                 'Dumbbell Bicep Curl',
    type:                 'accessory',
    equipment_type:       'dumbbell',
    body_part:            'biceps',
    default_target_sets:  3,
    default_target_reps:  '10-12',
    notes:                'Supinate wrist as you curl, full extension at bottom.',
  },
  {
    name:                 'Cable Tricep Pushdown',
    type:                 'accessory',
    equipment_type:       'cable',
    body_part:            'triceps',
    default_target_sets:  3,
    default_target_reps:  '12-15',
    video_url:            'https://res.cloudinary.com/dojtjhhiv/video/upload/v1778469558/zenkai/exercises/eg8zfnp5i2c2p2fdwbcu.mp4',
    notes:                'Elbows pinned to sides, full extension at bottom, control the eccentric.',
  },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const rows = exercises.map(ex => ({
      id:                   randomUUID(),
      name:                 ex.name,
      type:                 ex.type,
      equipment_type:       ex.equipment_type,
      body_part:            ex.body_part            ?? null,
      video_url:            ex.video_url            ?? null,
      notes:                ex.notes                ?? null,
      default_target_sets:  ex.default_target_sets  ?? null,
      default_target_reps:  ex.default_target_reps  ?? null,
      created_by:           null,
      tenant_id:            null,
      created_at:           now,
      updated_at:           now,
    }));

    await queryInterface.bulkInsert('exercises', rows, { ignoreDuplicates: true });
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('exercises', {
      name: exercises.map(e => e.name),
    });
  },
};
