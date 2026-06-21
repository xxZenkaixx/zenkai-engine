'use strict';

/**
 * One-off: copy a single program (template + days + exercise instances) from
 * the PROD database into the DEV database so it can be tested before a merge.
 *
 * Reads everything from env so no secrets live in this file:
 *   PROD_DATABASE_URL   External connection string for the prod DB (read-only here)
 *   DEV_DATABASE_URL    Connection string for the dev DB (written here)
 *   PROGRAM_ID          UUID of the program to copy   (use this OR PROGRAM_NAME)
 *   PROGRAM_NAME        Exact name of the program to copy
 *   DEV_OWNER_USER_ID   UUID of the dev user that should own the seeded program
 *   DEV_OWNER_EMAIL     ...or look the dev owner up by email instead
 *
 * Example:
 *   PROD_DATABASE_URL='postgres://...' DEV_DATABASE_URL='postgres://...' \
 *   PROGRAM_NAME='Hypertrophy Block A' DEV_OWNER_EMAIL='you@dev.test' \
 *   node seed-dev-program.js
 *
 * Behaviour:
 *   - Preserves prod UUIDs for program / days / instances, so superset_group_id
 *     and every internal link stays consistent.
 *   - ABORTS if the program id already exists in dev (re-run safe, no dupes).
 *   - Referenced library exercises are matched in dev by id, else by unique
 *     name, else inserted; each instance's exercise_id is remapped to the dev id.
 *   - All dev writes run inside one transaction — partial failure rolls back.
 */

const { Sequelize, QueryTypes } = require('sequelize');

const {
  PROD_DATABASE_URL,
  DEV_DATABASE_URL,
  PROGRAM_ID,
  PROGRAM_NAME,
  DEV_OWNER_USER_ID,
  DEV_OWNER_EMAIL,
} = process.env;

function connect(url) {
  // Both prod and dev are Render external Postgres, which require SSL.
  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  });
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!PROD_DATABASE_URL) fail('PROD_DATABASE_URL is required.');
  if (!DEV_DATABASE_URL) fail('DEV_DATABASE_URL is required.');
  if (!PROGRAM_ID && !PROGRAM_NAME) fail('Provide PROGRAM_ID or PROGRAM_NAME.');
  if (!DEV_OWNER_USER_ID && !DEV_OWNER_EMAIL) {
    fail('Provide DEV_OWNER_USER_ID or DEV_OWNER_EMAIL.');
  }

  const prod = connect(PROD_DATABASE_URL);
  const dev = connect(DEV_DATABASE_URL);

  try {
    await prod.authenticate();
    await dev.authenticate();
    console.log('Connected to prod (read) and dev (write).');

    // 1. Resolve the dev owner up front — must exist before we write anything.
    const owner = (await dev.query(
      DEV_OWNER_USER_ID
        ? 'SELECT id, email FROM users WHERE id = :v LIMIT 1'
        : 'SELECT id, email FROM users WHERE email = :v LIMIT 1',
      { replacements: { v: DEV_OWNER_USER_ID || DEV_OWNER_EMAIL }, type: QueryTypes.SELECT }
    ))[0];
    if (!owner) fail(`Dev owner not found (${DEV_OWNER_USER_ID || DEV_OWNER_EMAIL}).`);
    console.log(`Dev owner: ${owner.email} (${owner.id})`);

    // 2. Load the program from prod.
    const program = (await prod.query(
      PROGRAM_ID
        ? 'SELECT * FROM programs WHERE id = :v LIMIT 1'
        : 'SELECT * FROM programs WHERE name = :v LIMIT 1',
      { replacements: { v: PROGRAM_ID || PROGRAM_NAME }, type: QueryTypes.SELECT }
    ))[0];
    if (!program) fail(`Program not found in prod (${PROGRAM_ID || PROGRAM_NAME}).`);
    console.log(`Found program: "${program.name}" (${program.id})`);

    // 3. Re-run guard — never double-seed the same program.
    const exists = (await dev.query(
      'SELECT 1 FROM programs WHERE id = :id LIMIT 1',
      { replacements: { id: program.id }, type: QueryTypes.SELECT }
    ))[0];
    if (exists) fail(`Program ${program.id} already exists in dev. Nothing to do.`);

    // 4. Load days + instances from prod.
    const days = await prod.query(
      'SELECT * FROM program_days WHERE program_id = :id ORDER BY day_number',
      { replacements: { id: program.id }, type: QueryTypes.SELECT }
    );
    const dayIds = days.map((d) => d.id);
    const instances = dayIds.length
      ? await prod.query(
          'SELECT * FROM exercise_instances WHERE program_day_id IN (:ids) ORDER BY order_index',
          { replacements: { ids: dayIds }, type: QueryTypes.SELECT }
        )
      : [];
    console.log(`Loaded ${days.length} day(s), ${instances.length} exercise instance(s).`);

    // 5. Resolve referenced library exercises, remapping exercise_id -> dev id.
    const prodExerciseIds = [...new Set(instances.map((i) => i.exercise_id).filter(Boolean))];
    const exerciseIdMap = new Map(); // prod exercise_id -> dev exercise_id
    for (const exId of prodExerciseIds) {
      const ex = (await prod.query(
        'SELECT * FROM exercises WHERE id = :id LIMIT 1',
        { replacements: { id: exId }, type: QueryTypes.SELECT }
      ))[0];
      if (!ex) { exerciseIdMap.set(exId, null); continue; } // dangling ref -> null

      const byId = (await dev.query(
        'SELECT id FROM exercises WHERE id = :id LIMIT 1',
        { replacements: { id: ex.id }, type: QueryTypes.SELECT }
      ))[0];
      if (byId) { exerciseIdMap.set(exId, byId.id); continue; }

      const byName = (await dev.query(
        'SELECT id FROM exercises WHERE name = :name LIMIT 1',
        { replacements: { name: ex.name }, type: QueryTypes.SELECT }
      ))[0];
      if (byName) { exerciseIdMap.set(exId, byName.id); continue; }

      exerciseIdMap.set(exId, ex); // not present yet — insert inside the txn below
    }

    // 6. Write everything to dev in one transaction.
    await dev.transaction(async (t) => {
      const opts = { transaction: t, type: QueryTypes.INSERT };

      // Insert any missing library exercises first (created_by -> dev owner).
      for (const [prodId, val] of exerciseIdMap) {
        if (val == null || typeof val === 'string') continue; // already resolved
        const ex = val;
        await dev.query(
          `INSERT INTO exercises
             (id, name, type, equipment_type, body_part, video_url, notes,
              default_target_sets, default_target_reps, created_by, tenant_id,
              created_at, updated_at)
           VALUES
             (:id, :name, :type, :equipment_type, :body_part, :video_url, :notes,
              :default_target_sets, :default_target_reps, :created_by, :tenant_id,
              NOW(), NOW())`,
          {
            replacements: {
              id: ex.id, name: ex.name, type: ex.type,
              equipment_type: ex.equipment_type, body_part: ex.body_part ?? null,
              video_url: ex.video_url ?? null, notes: ex.notes ?? null,
              default_target_sets: ex.default_target_sets ?? null,
              default_target_reps: ex.default_target_reps ?? null,
              created_by: owner.id, tenant_id: ex.tenant_id ?? null,
            },
            ...opts,
          }
        );
        exerciseIdMap.set(prodId, ex.id);
      }

      // Program (owner remapped, prod UUID + flags preserved).
      // deload_weeks is integer[]; build an explicit array literal because
      // Sequelize replacements flatten a JS array into a scalar. Values are
      // coerced to integers, so the inlined literal is injection-safe.
      const dw = Array.isArray(program.deload_weeks) ? program.deload_weeks : [];
      const deloadSql = dw.length
        ? `ARRAY[${dw.map((n) => parseInt(n, 10)).join(',')}]::integer[]`
        : `ARRAY[]::integer[]`;
      await dev.query(
        `INSERT INTO programs
           (id, name, weeks, deload_weeks, user_id, is_template, created_at, updated_at)
         VALUES
           (:id, :name, :weeks, ${deloadSql}, :user_id, :is_template, NOW(), NOW())`,
        {
          replacements: {
            id: program.id, name: program.name, weeks: program.weeks,
            user_id: owner.id, is_template: program.is_template ?? false,
          },
          ...opts,
        }
      );

      // Days.
      for (const d of days) {
        await dev.query(
          `INSERT INTO program_days
             (id, program_id, day_number, name, created_at, updated_at)
           VALUES (:id, :program_id, :day_number, :name, NOW(), NOW())`,
          {
            replacements: {
              id: d.id, program_id: program.id,
              day_number: d.day_number, name: d.name ?? null,
            },
            ...opts,
          }
        );
      }

      // Instances (every column carried; exercise_id remapped).
      for (const i of instances) {
        const cols = Object.keys(i).filter((c) => c !== 'created_at' && c !== 'updated_at');
        const remapped = { ...i, exercise_id: i.exercise_id ? exerciseIdMap.get(i.exercise_id) : null };
        const colSql = cols.join(', ');
        const valSql = cols.map((c) => `:${c}`).join(', ');
        await dev.query(
          `INSERT INTO exercise_instances (${colSql}) VALUES (${valSql})`,
          { replacements: cols.reduce((a, c) => ({ ...a, [c]: remapped[c] ?? null }), {}), ...opts }
        );
      }
    });

    console.log(`\nDone. Seeded "${program.name}" into dev, owned by ${owner.email}.`);
    console.log(`  program_id: ${program.id}`);
    console.log(`  days: ${days.length}  instances: ${instances.length}  exercises copied: ` +
      `${[...exerciseIdMap.values()].length}`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prod.close();
    await dev.close();
  }
}

main();
