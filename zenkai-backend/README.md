# zenkai-backend

## Production Recovery

If the live site cannot fetch active program or workout data, the production DB schema is likely behind the current models.

After redeploying, run once in the Render shell:

```
npx sequelize-cli db:migrate
```

This applies any pending migrations. Required any time new columns are added to models.
