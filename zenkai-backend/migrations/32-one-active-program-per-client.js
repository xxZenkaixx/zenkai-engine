'use strict';
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE client_programs SET active = false
      WHERE id NOT IN (
        SELECT DISTINCT ON (client_id) id
        FROM client_programs
        WHERE active = true
        ORDER BY client_id, updated_at DESC
      )
      AND active = true
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_client_programs_one_active
      ON client_programs (client_id)
      WHERE active = true
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS uq_client_programs_one_active`
    );
  }
};
