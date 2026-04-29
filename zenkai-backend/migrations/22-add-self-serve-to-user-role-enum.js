'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'self-serve';`
    );
  },
  down: async () => {
    // Postgres does not support removing enum values
  }
};
