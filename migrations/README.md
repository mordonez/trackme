# Database Migrations

This directory contains SQL migration scripts for the TrackMe database.

## Running Migrations

### For Production (Remote Database)

To apply a migration to the production database:

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

1. **Always backup your database before running migrations in production**
2. Migrations should be run in order (001, 002, 003, etc.)
3. Test migrations in local environment first before applying to production
4. SQLite doesn't support `IF NOT EXISTS` for `ALTER TABLE ADD COLUMN`, so running a migration twice will cause an error (this is by design to prevent accidental re-runs)
5. Before running a migration, verify it hasn't been applied yet by checking the table schema

## Creating New Migrations

When creating a new migration:

1. Create a new file with the next sequential number: `XXX_description.sql`
2. Add clear comments explaining what the migration does
3. Test the migration locally first
4. Document the migration in this README
5. Update the main `schema.sql` file to reflect the new structure for fresh installations

## Checking Applied Migrations

To see the current schema of your database:

```bash
# Local
npx wrangler d1 execute trackme-db --local --command="PRAGMA table_info(symptom_logs)"

# Production
npx wrangler d1 execute trackme-db --remote --command="PRAGMA table_info(symptom_logs)"
```

This will show all columns in the symptom_logs table, including medication_taken if the migration has been applied.
