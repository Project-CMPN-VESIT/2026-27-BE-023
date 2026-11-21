const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing Supabase credentials in .env");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({ connectionString });

const migrationSQL = `
-- 1. Delete duplicate work_logs, keeping only the latest one by created_at
DELETE FROM work_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, date) id
  FROM work_logs
  ORDER BY employee_id, date, created_at DESC
);

-- 2. Add the unique constraint to work_logs
ALTER TABLE work_logs 
DROP CONSTRAINT IF EXISTS unique_employee_date_work_logs;

ALTER TABLE work_logs
ADD CONSTRAINT unique_employee_date_work_logs UNIQUE (employee_id, date);
`;

async function runMigration() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("Running migration to clean duplicates and add UNIQUE constraint to work_logs...");
    await client.query(migrationSQL);
    console.log("✅ Migration completed successfully! work_logs table is now unique per employee per date.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
