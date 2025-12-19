#!/bin/bash

# Backup Cassandra data

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cassandra_backup_$TIMESTAMP.cql"

echo "📦 Backing up Cassandra data..."
echo "Backup file: $BACKUP_FILE"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export schema and data
docker exec $(docker ps -qf "name=cassandra") cqlsh -e "
DESCRIBE KEYSPACE betting_ledger;
" > "$BACKUP_FILE"

# Export users table
docker exec $(docker ps -qf "name=cassandra") cqlsh -e "
COPY betting_ledger.users TO STDOUT;
" >> "$BACKUP_FILE"

# Export transactions table
docker exec $(docker ps -qf "name=cassandra") cqlsh -e "
COPY betting_ledger.ledger_transactions TO STDOUT;
" >> "$BACKUP_FILE"

echo ""
echo "✅ Backup complete: $BACKUP_FILE"
echo ""
echo "To restore, use: ./scripts/restore-cassandra.sh $BACKUP_FILE"
