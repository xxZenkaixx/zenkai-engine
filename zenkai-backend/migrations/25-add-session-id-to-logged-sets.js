'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('logged_sets', 'session_id', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null
    });

    // Backfill: one UUID per (client_id, DATE(completed_at), program_day_id).
    // Same-day same-day-id rows collapse into one session — best approximation
    // for rows that predate session identity.
    await queryInterface.sequelize.query(`
      WITH groups AS (
        SELECT
          ls.client_id,
          DATE(ls.completed_at) AS session_date,
          pd.id AS program_day_id,
          gen_random_uuid() AS new_session_id
        FROM logged_sets ls
        JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
        JOIN program_days pd ON ei.program_day_id = pd.id
        GROUP BY ls.client_id, DATE(ls.completed_at), pd.id
      ),
      set_sessions AS (
        SELECT
          ls.id AS set_id,
          g.new_session_id
        FROM logged_sets ls
        JOIN exercise_instances ei ON ls.exercise_instance_id = ei.id
        JOIN program_days pd ON ei.program_day_id = pd.id
        JOIN groups g
          ON ls.client_id = g.client_id
          AND DATE(ls.completed_at) = g.session_date
          AND pd.id = g.program_day_id
      )
      UPDATE logged_sets
      SET session_id = ss.new_session_id
      FROM set_sessions ss
      WHERE logged_sets.id = ss.set_id;
    `);

    await queryInterface.addIndex('logged_sets', ['exercise_instance_id', 'session_id'], {
      name: 'logged_sets_exercise_instance_session_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('logged_sets', 'logged_sets_exercise_instance_session_idx');
    await queryInterface.removeColumn('logged_sets', 'session_id');
  }
};
