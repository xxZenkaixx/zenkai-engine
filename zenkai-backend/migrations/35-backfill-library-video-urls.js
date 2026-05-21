'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE exercise_instances ei
      SET video_url = e.video_url
      FROM exercises e
      WHERE ei.exercise_id = e.id
        AND ei.video_url IS NULL
        AND e.video_url IS NOT NULL;
    `);
  },
  down: async () => {
  },
};
