// Central router. Mounts all API route groups under /api
'use strict';

const express = require('express');
const router = express.Router();

router.use('/clients', require('./clients'));
router.use('/programs', require('./programs'));
router.use('/program-days', require('./programDays'));
router.use('/exercise-instances', require('./exerciseInstances'));
router.use('/client-programs', require('./clientPrograms'));
router.use('/sets', require('./loggedSets'));

module.exports = router;
