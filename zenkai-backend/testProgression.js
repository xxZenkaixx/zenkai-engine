// * manual test runner for progression application service
const { sequelize } = require('./models');
const { applyProgressionForWorkout } = require('./services/progressionApplicationService');

async function runTest() {
  try {
    // TODO: replace these with REAL IDs from your DB
    const clientId = '0481deb5-2e84-4e6d-a78e-e846a73a3422';
    const programDayId = 'cb751dc4-e262-4ba8-bf0a-d1604faaa3be';

    const result = await applyProgressionForWorkout(clientId, programDayId);

    console.log('RESULT:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await sequelize.close();
  }
}

runTest();
