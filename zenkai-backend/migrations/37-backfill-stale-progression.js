'use strict';

/**
 * ONE-TIME BACKFILL — re-apply progression to stale client accounts.
 *
 * WHY
 *   Accounts created before the recent progressionApplicationService fixes
 *   never had their next-week targets written to client_exercise_targets
 *   (the per-client override table). Their prescriptions are frozen at the
 *   original template values even though they have a full logged history.
 *   The most affected account is the main daily-login client.
 *
 * WHAT THIS DOES
 *   For every eligible client, for every program_day they have logged sets
 *   against, it replays the CURRENT (fixed) progression logic over their
 *   existing logged_sets via the live service:
 *       applyProgressionForWorkout()    -> stages exercise_progressions
 *       mutateTargetsFromProgressions() -> upserts client_exercise_targets
 *   This is exactly the path the app runs after a workout is finished, so the
 *   result is identical to what a correctly-progressed client would have.
 *
 * SAFETY GUARANTEES
 *   1. Templates are never touched. The service writes ONLY to
 *      client_exercise_targets and exercise_progressions — never to
 *      exercise_instances. (Confirmed in service header + upsert SQL.)
 *   2. Full backup before any write. Both mutated tables are snapshotted into
 *      *_backup_pre37 tables. down() restores from them.
 *   3. Idempotent. The recompute is skipped if the backup tables already
 *      exist (i.e. this already ran), so a manual re-run is a no-op. Within a
 *      single run, weight/cable next-targets are derived deterministically
 *      from logged_sets, so they cannot drift.
 *   4. Scopable. Set BACKFILL_CLIENT_ID to limit the run to one client (the
 *      main daily login). Set BACKFILL_BEFORE=YYYY-MM-DD to limit to accounts
 *      created before a cutoff. With neither set, every client that has an
 *      active program and logged history is processed.
 *   5. Per-client/day errors are caught and logged; one bad day never aborts
 *      the batch or rolls back already-fixed clients.
 */

const BACKUP_CET = 'client_exercise_targets_backup_pre37';
const BACKUP_EP = 'exercise_progressions_backup_pre37';

module.exports = {
  up: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    const clientFilter = (process.env.BACKFILL_CLIENT_ID || '').trim() || null;
    const beforeDate = (process.env.BACKFILL_BEFORE || '').trim() || null;

    // ---- Idempotency guard ------------------------------------------------
    // If the backup table already exists, the recompute has already run.
    // Re-running would be safe for weight/cable but could re-step rep-based
    // targets, so we hard-stop instead.
    const [existing] = await sequelize.query(
      `SELECT to_regclass(:t) AS reg`,
      { replacements: { t: `public.${BACKUP_CET}` } }
    );
    if (existing[0] && existing[0].reg) {
      console.log(
        `[BACKFILL-37] Backup table ${BACKUP_CET} already exists — recompute ` +
        `already ran. Skipping (idempotent no-op). Run down() first to redo.`
      );
      return;
    }

    // ---- 1. Snapshot the two tables we are about to mutate ----------------
    await sequelize.query(
      `CREATE TABLE ${BACKUP_CET} AS TABLE client_exercise_targets`
    );
    await sequelize.query(
      `CREATE TABLE ${BACKUP_EP} AS TABLE exercise_progressions`
    );
    console.log(
      `[BACKFILL-37] Backed up client_exercise_targets -> ${BACKUP_CET}, ` +
      `exercise_progressions -> ${BACKUP_EP}.`
    );

    // ---- 2. Resolve the set of clients to process -------------------------
    // Eligible = has an ACTIVE client_program AND at least one logged set.
    // Optionally scoped to a single client and/or accounts created before a
    // cutoff date.
    const replacements = {};
    let clientWhere = '';
    if (clientFilter) {
      clientWhere += ` AND c.id = :clientId`;
      replacements.clientId = clientFilter;
    }
    if (beforeDate) {
      clientWhere += ` AND c.created_at < :beforeDate`;
      replacements.beforeDate = beforeDate;
    }

    const [clients] = await sequelize.query(
      `
      SELECT DISTINCT c.id AS client_id, c.name AS client_name
      FROM clients c
      JOIN client_programs cp ON cp.client_id = c.id AND cp.active = true
      WHERE EXISTS (
        SELECT 1 FROM logged_sets ls WHERE ls.client_id = c.id
      )
      ${clientWhere}
      ORDER BY c.name
      `,
      { replacements }
    );

    console.log(
      `[BACKFILL-37] ${clients.length} client(s) to process` +
      (clientFilter ? ` (scoped to client_id=${clientFilter})` : '') +
      (beforeDate ? ` (created before ${beforeDate})` : '') + '.'
    );

    // require AFTER backup so a load error can't leave us half-mutated
    const {
      applyProgressionForWorkout,
      mutateTargetsFromProgressions
    } = require('../services/progressionApplicationService');

    // ---- 3. Replay progression per client, per logged program_day ---------
    const summary = [];
    for (const { client_id, client_name } of clients) {
      // Distinct program_days this client actually has logged history for.
      const [days] = await sequelize.query(
        `
        SELECT DISTINCT ei.program_day_id AS program_day_id
        FROM logged_sets ls
        JOIN exercise_instances ei ON ei.id = ls.exercise_instance_id
        WHERE ls.client_id = :clientId
          AND ei.program_day_id IS NOT NULL
        `,
        { replacements: { clientId: client_id } }
      );

      for (const { program_day_id } of days) {
        try {
          await applyProgressionForWorkout(client_id, program_day_id);
          const applied = await mutateTargetsFromProgressions(client_id, program_day_id);
          summary.push({ client_name, program_day_id, applied: applied.length });
          console.log(
            `[BACKFILL-37] client="${client_name}" day=${program_day_id} ` +
            `-> ${applied.length} target(s) written`
          );
        } catch (err) {
          // No active assignment / no sets for the day are expected, non-fatal.
          console.log(
            `[BACKFILL-37] SKIP client="${client_name}" day=${program_day_id}: ${err.message}`
          );
        }
      }
    }

    const totalApplied = summary.reduce((n, s) => n + s.applied, 0);
    console.log(
      `[BACKFILL-37] DONE. Processed ${clients.length} client(s); ` +
      `${totalApplied} client_exercise_targets row(s) written/updated.`
    );
  },

  down: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;

    const [cetBackup] = await sequelize.query(
      `SELECT to_regclass(:t) AS reg`,
      { replacements: { t: `public.${BACKUP_CET}` } }
    );
    if (!cetBackup[0] || !cetBackup[0].reg) {
      console.log(`[BACKFILL-37] No backup tables found — nothing to restore.`);
      return;
    }

    // Restore both tables to their pre-migration contents, then drop backups.
    // DELETE + INSERT (not TRUNCATE) keeps it transactional and FK-safe.
    await sequelize.query(`DELETE FROM client_exercise_targets`);
    await sequelize.query(
      `INSERT INTO client_exercise_targets SELECT * FROM ${BACKUP_CET}`
    );

    await sequelize.query(`DELETE FROM exercise_progressions`);
    await sequelize.query(
      `INSERT INTO exercise_progressions SELECT * FROM ${BACKUP_EP}`
    );

    await sequelize.query(`DROP TABLE IF EXISTS ${BACKUP_CET}`);
    await sequelize.query(`DROP TABLE IF EXISTS ${BACKUP_EP}`);

    console.log(
      `[BACKFILL-37] Restored client_exercise_targets and ` +
      `exercise_progressions from backup; dropped backup tables.`
    );
  }
};
