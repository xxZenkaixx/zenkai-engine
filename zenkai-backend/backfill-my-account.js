const { sequelize } = require('./models');
const { applyProgressionForWorkout, mutateTargetsFromProgressions } = require('./services/progressionApplicationService');

async function run() {
  const clientId = 'b20ebc82-8ea5-4fed-85af-d571a50af45c';
  console.log('Starting backfill for client:', clientId);

  try {
    const [days] = await sequelize.query(`
      SELECT DISTINCT ei.program_day_id
      FROM logged_sets ls
      JOIN exercise_instances ei ON ei.id = ls.exercise_instance_id
      WHERE ls.client_id = :clientId
    `, { replacements: { clientId } });

    for (const { program_day_id } of days) {
      await applyProgressionForWorkout(clientId, program_day_id);
      await mutateTargetsFromProgressions(clientId, program_day_id);
      console.log(`Processed day ${program_day_id}`);
    }

    console.log('Backfill completed successfully for your account.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
