// Central router. Mounts all API route groups under /api
'use strict';

const express = require('express');
const router = express.Router();
const requireRole = require('../middleware/requireRole');

router.use('/auth',                    require('./auth'));
router.use('/clients',                 requireRole('admin'), require('./clients'));
router.use('/programs',                require('./programs'));
router.use('/program-days',            require('./programDays'));
router.use('/exercise-instances',      require('./exerciseInstances'));
router.use('/client-programs',         requireRole('admin'), require('./clientPrograms'));
router.use('/client-exercise-targets', requireRole('admin'), require('./clientExerciseTargets'));
router.use('/sets',                    require('./loggedSets'));
router.use('/progression',             require('./progression'));
router.use('/history',                 require('./history'));

module.exports = router;
