const { sequelize } = require('./models');
const { applyProgressionForWorkout, mutateTargetsFromProgressions } = require('./services/progressionApplicationService');

async function run() {
  const clientId = 'b20ebc82-8ea5-4fed-85af-d571a50af45c';
  console.log('Starting backfill for client:', clientId);

  try {
    // Safety snapshot before any write. IF NOT EXISTS keeps the FIRST backup
    // intact on a re-run, so you can always restore the original state.
    await sequelize.query(`CREATE TABLE IF NOT EXISTS client_exercise_targets_backup_manual AS TABLE client_exercise_targets`);
    await sequelize.query(`CREATE TABLE IF NOT EXISTS exercise_progressions_backup_manual AS TABLE exercise_progressions`);
    console.log('Backed up client_exercise_targets + exercise_progressions.');

    const [days] = await sequelize.query(`
      SELECT DISTINCT ei.program_day_id
      FROM logged_sets ls
      JOIN exercise_instances ei ON ei.id = ls.exercise_instance_id
      WHERE ls.client_id = :clientId
        AND ei.program_day_id IS NOT NULL
    `, { replacements: { clientId } });

    console.log(`Found ${days.length} program day(s) with logged history.`);

    for (const { program_day_id } of days) {
      await applyProgressionForWorkout(clientId, program_day_id);
      const applied = await mutateTargetsFromProgressions(clientId, program_day_id);
      console.log(`Processed day ${program_day_id} -> ${applied.length} target(s) written`);
    }

    console.log('Backfill completed successfully for your account.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
