# Database Migrations

This directory contains SQL migration scripts for the TrackMe database.

## Automated Migrations (Production)

**Migrations are automatically applied during deployment to production.**

When code is pushed to the `main` branch, the GitHub Actions deployment workflow:
1. Deploys the application to Cloudflare Workers
2. Automatically runs any pending database migrations using `scripts/run-migrations.sh`

The migration system:
- Creates a `schema_migrations` table to track applied migrations
- Runs migrations in order (001, 002, 003, etc.)
- Skips migrations that have already been applied
- Stops deployment if any migration fails

**You don't need to manually run migrations in production** - they happen automatically!

### Required GitHub Secrets

For automated migrations to work, ensure these secrets are configured in your GitHub repository:
- `CLOUDFLARE_API_TOKEN` - API token with Workers and D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID (required for D1 operations)

Without these secrets properly configured, the migration step will fail during deployment.

## Manual Migration (if needed)

### For Production (Remote Database)

If you need to manually apply a migration:

```bash
npx wrangler d1 execute trackme-db --remote --file=./migrations/XXX_migration_name.sql
```

Example:
```bash
npx wrangler d1 execute trackme-db --remote --file=./migrations/001_add_medication_taken.sql
```

### For Local Development

To apply a migration to the local development database:

```bash
npx wrangler d1 execute trackme-db --local --file=./migrations/XXX_migration_name.sql
```

Example:
```bash
npx wrangler d1 execute trackme-db --local --file=./migrations/001_add_medication_taken.sql
```

## Migration Files

Each migration file is numbered sequentially and describes a specific database change:

- `001_add_medication_taken.sql` - Adds medication_taken column to symptom_logs table

## Important Notes

1. **Migrations run automatically on deployment to main branch**
2. **Always backup your database before running manual migrations in production**
3. Migrations should be run in order (001, 002, 003, etc.)
4. Test migrations in local environment first before pushing to main
5. SQLite doesn't support `IF NOT EXISTS` for `ALTER TABLE ADD COLUMN`, so running a migration twice will cause an error (this is by design to prevent accidental re-runs)
6. The automated system tracks applied migrations in the `schema_migrations` table

## Creating New Migrations

When creating a new migration:

1. Create a new file with the next sequential number: `XXX_description.sql`
2. Add clear comments explaining what the migration does
3. Test the migration locally first
4. Document the migration in this README
5. Update the main `schema.sql` file to reflect the new structure for fresh installations
6. Push to main - the migration will run automatically during deployment

## Checking Applied Migrations

To see which migrations have been applied:

```bash
# Production
npx wrangler d1 execute trackme-db --remote --command="SELECT * FROM schema_migrations ORDER BY version"
```

To see the current schema of your database:

```bash
# Local
npx wrangler d1 execute trackme-db --local --command="PRAGMA table_info(symptom_logs)"

# Production
npx wrangler d1 execute trackme-db --remote --command="PRAGMA table_info(symptom_logs)"
```

This will show all columns in the symptom_logs table, including medication_taken if the migration has been applied.

## Migration Script

The automated migration script is located at `scripts/run-migrations.sh`. It:
- Creates the `schema_migrations` tracking table if needed
- Checks which migrations have been applied
- Runs pending migrations in order
- Records successful migrations
- Provides detailed output during deployment
