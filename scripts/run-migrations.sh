#!/bin/bash
# Script to run database migrations in order
# This script is designed to be run in GitHub Actions during deployment

set -e  # Exit on error

echo "🔄 Starting database migration process..."

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    exit 1
fi

# Create migrations tracking table if it doesn't exist
echo "📋 Ensuring migrations tracking table exists..."
wrangler d1 execute trackme-db --remote --command="
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);" || {
    echo "❌ Failed to create migrations tracking table"
    exit 1
}

# Get list of applied migrations
echo "🔍 Checking applied migrations..."
APPLIED_MIGRATIONS=$(wrangler d1 execute trackme-db --remote --command="SELECT version FROM schema_migrations ORDER BY version" --json 2>/dev/null | jq -r '.[0].results[].version' 2>/dev/null || echo "")

# Find all migration files
MIGRATION_FILES=$(ls migrations/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo "ℹ️  No migration files found in migrations/ directory"
    exit 0
fi

MIGRATIONS_RUN=0
MIGRATIONS_SKIPPED=0

# Process each migration file
for MIGRATION_FILE in $MIGRATION_FILES; do
    # Extract version from filename (e.g., 001 from 001_add_medication_taken.sql)
    MIGRATION_VERSION=$(basename "$MIGRATION_FILE" | cut -d'_' -f1)
    
    # Check if migration has already been applied
    if echo "$APPLIED_MIGRATIONS" | grep -q "^${MIGRATION_VERSION}$"; then
        echo "⏭️  Skipping $MIGRATION_FILE (already applied)"
        MIGRATIONS_SKIPPED=$((MIGRATIONS_SKIPPED + 1))
        continue
    fi
    
    echo "🚀 Applying migration: $MIGRATION_FILE"
    
    # Run the migration
    if wrangler d1 execute trackme-db --remote --file="$MIGRATION_FILE"; then
        # Record successful migration
        wrangler d1 execute trackme-db --remote --command="INSERT INTO schema_migrations (version) VALUES ('${MIGRATION_VERSION}')" > /dev/null
        echo "✅ Successfully applied $MIGRATION_FILE"
        MIGRATIONS_RUN=$((MIGRATIONS_RUN + 1))
    else
        echo "❌ Failed to apply $MIGRATION_FILE"
        exit 1
    fi
done

echo ""
echo "📊 Migration Summary:"
echo "   - Migrations applied: $MIGRATIONS_RUN"
echo "   - Migrations skipped: $MIGRATIONS_SKIPPED"
echo ""

if [ $MIGRATIONS_RUN -gt 0 ]; then
    echo "✨ Database migrations completed successfully!"
else
    echo "ℹ️  No new migrations to apply"
fi
