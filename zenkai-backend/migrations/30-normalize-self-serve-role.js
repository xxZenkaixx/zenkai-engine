'use strict';
module.exports = {
  up: async (queryInterface) => {
    // Ensure 'self-serve' enum value exists (idempotent — migration 22 already added it)
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'self-serve';`
    );
    // Normalize any legacy 'selfServe' rows to 'self-serve'
    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'self-serve' WHERE role = 'selfServe';`
    );
    // Align Postgres column default with the model default
    await queryInterface.sequelize.query(
      `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'self-serve';`
    );
  },
  down: async (queryInterface) => {
    // Roll back the column default; data normalization and enum additions are one-way in Postgres.
    await queryInterface.sequelize.query(
      `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin';`
    );
  }
};
