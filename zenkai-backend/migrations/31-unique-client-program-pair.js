'use strict';
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DELETE FROM client_programs
      WHERE id NOT IN (
        SELECT DISTINCT ON (client_id, program_id) id
        FROM client_programs
        ORDER BY client_id, program_id, created_at DESC
      )
    `);
    await queryInterface.addConstraint('client_programs', {
      fields: ['client_id', 'program_id'],
      type: 'unique',
      name: 'uq_client_programs_client_program'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeConstraint('client_programs', 'uq_client_programs_client_program');
  }
};
