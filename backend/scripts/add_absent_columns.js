const { Client } = require('pg');
require('dotenv').config();

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

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    console.log("Adding absent_days and absent_deduction columns to salary_records if they don't exist...");
    await client.query(`
      ALTER TABLE salary_records 
      ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS absent_deduction NUMERIC DEFAULT 0;
    `);
    console.log("✅ Columns successfully verified/added to salary_records table!");
  } catch (err) {
    console.error("❌ Error running migration:", err.message);
  } finally {
    await client.end();
  }
}

run();
