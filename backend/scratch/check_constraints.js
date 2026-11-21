const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({ connectionString });

async function run() {
  await client.connect();
  console.log("Connected to database. Checking constraints on work_logs...");
  
  const res = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'work_logs';
  `);
  console.log("Constraints:", res.rows);

  const indexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'work_logs';
  `);
  console.log("Indexes:", indexes.rows);

  await client.end();
}

run().catch(console.error);
