'use strict';

const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.get('/:clientId/workouts', async (req, res) => {
  try {
    const { clientId } = req.params;
    const rows = await sequelize.query(`
      SELECT
        DATE(ls.completed_at) AS date,
        pd.id AS program_day_id,
        pd.name AS day_name,
        pd.day_number,
        pd.program_id,
        COUNT(ls.id) AS total_sets
      FROM logged_sets ls
      JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
      JOIN program_days pd ON ei.program_day_id = pd.id
      WHERE ls.client_id = :clientId
      GROUP BY DATE(ls.completed_at), pd.id, pd.name, pd.day_number, pd.program_id
      ORDER BY DATE(ls.completed_at) DESC
    `, {
      replacements: { clientId },
      type: QueryTypes.SELECT
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const rows = await sequelize.query(`
      SELECT
        DATE(ls.completed_at) AS date,
        pd.id AS program_day_id,
        pd.name AS day_name,
        pd.day_number
      FROM logged_sets ls
      JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
      JOIN program_days pd ON ei.program_day_id = pd.id
      WHERE ls.client_id = :clientId
      GROUP BY DATE(ls.completed_at), pd.id, pd.name, pd.day_number
      ORDER BY DATE(ls.completed_at) DESC
    `, {
      replacements: { clientId },
      type: QueryTypes.SELECT
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/detail', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { date, program_day_id } = req.query;

    if (!date || !program_day_id) {
      return res.status(400).json({ error: 'date and program_day_id are required' });
    }

    const rows = await sequelize.query(`
      SELECT
        ei.id AS exercise_instance_id,
        ei.name AS exercise_name,
        ei.order_index,
        ls.id AS set_id,
        ls.set_number,
        ls.completed_reps,
        ls.completed_weight,
        ls.exercise_note
      FROM logged_sets ls
      JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
      WHERE ls.client_id = :clientId
        AND ei.program_day_id = :programDayId
        AND DATE(ls.completed_at) = :date
      ORDER BY ei.order_index ASC, ls.set_number ASC
    `, {
      replacements: { clientId, programDayId: program_day_id, date },
      type: QueryTypes.SELECT
    });

    const exerciseMap = {};

    for (const row of rows) {
      if (!exerciseMap[row.exercise_instance_id]) {
        exerciseMap[row.exercise_instance_id] = {
          exercise_name: row.exercise_name,
          order_index: row.order_index,
          exercise_note: null,
          sets: []
        };
      }

      if (!exerciseMap[row.exercise_instance_id].exercise_note && row.exercise_note) {
        exerciseMap[row.exercise_instance_id].exercise_note = row.exercise_note;
      }

      exerciseMap[row.exercise_instance_id].sets.push({
        set_id: row.set_id,
        set_number: row.set_number,
        completed_reps: row.completed_reps,
        completed_weight: row.completed_weight
      });
    }

    const exercises = Object.values(exerciseMap).sort((a, b) => a.order_index - b.order_index);
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/summary', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const [stats] = await sequelize.query(`
      SELECT
        COUNT(*) AS total_sets,
        MAX(DATE(completed_at)) AS most_recent_date,
        COUNT(DISTINCT exercise_instance_id) AS distinct_exercises
      FROM logged_sets
      WHERE client_id = :clientId
    `, {
      replacements: { clientId },
      type: QueryTypes.SELECT
    });

    const [{ total_workouts }] = await sequelize.query(`
      SELECT COUNT(*) AS total_workouts
      FROM (
        SELECT DISTINCT DATE(ls.completed_at), pd.id
        FROM logged_sets ls
        JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
        JOIN program_days pd ON ei.program_day_id = pd.id
        WHERE ls.client_id = :clientId
      ) AS sessions
    `, {
      replacements: { clientId },
      type: QueryTypes.SELECT
    });

    res.json({
      total_workouts: parseInt(total_workouts, 10),
      total_sets: parseInt(stats.total_sets, 10),
      most_recent_date: stats.most_recent_date,
      distinct_exercises: parseInt(stats.distinct_exercises, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/exercises', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const rows = await sequelize.query(`
      SELECT
        ei.id AS exercise_instance_id,
        ei.name AS exercise_name,
        pd.name AS day_name,
        pd.day_number,
        MAX(DATE(ls.completed_at)) AS last_logged
      FROM logged_sets ls
      JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
      JOIN program_days pd ON ei.program_day_id = pd.id
      WHERE ls.client_id = :clientId
      GROUP BY ei.id, ei.name, pd.name, pd.day_number
      ORDER BY last_logged DESC
    `, {
      replacements: { clientId },
      type: QueryTypes.SELECT
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/exercises/:exerciseInstanceId', async (req, res) => {
  try {
    const { clientId, exerciseInstanceId } = req.params;
    if (!clientId || !exerciseInstanceId) {
      return res.status(400).json({ error: 'clientId and exerciseInstanceId are required' });
    }

    const rows = await sequelize.query(`
      SELECT
        DATE(ls.completed_at) AS date,
        pd.name AS day_name,
        pd.day_number,
        ls.set_number,
        ls.completed_reps,
        ls.completed_weight
      FROM logged_sets ls
      JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
      JOIN program_days pd ON ei.program_day_id = pd.id
      WHERE ls.client_id = :clientId
        AND ls.exercise_instance_id = :exerciseInstanceId
      ORDER BY ls.completed_at ASC, ls.set_number ASC
    `, {
      replacements: { clientId, exerciseInstanceId },
      type: QueryTypes.SELECT
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
