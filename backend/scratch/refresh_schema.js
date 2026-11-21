const { Client } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({
  connectionString,
});

async function refreshSchema() {
  try {
    await client.connect();
    console.log("🔄 Notifying PostgREST to reload schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✅ PostgREST schema cache reload triggered successfully!");
  } catch (err) {
    console.error("❌ Failed to notify PostgREST:", err.message);
  } finally {
    await client.end();
  }
}

refreshSchema();
