const { Client } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD || DB_PASSWORD === 'YOUR_DATABASE_PASSWORD_HERE') {
  console.error("❌ ERROR: Please set your DB_PASSWORD in the .env file to run this script.");
  console.error("You can find or reset your database password in your Supabase project settings.");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({
  connectionString,
});

const createTablesSQL = `
-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    quantity_sold INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    predicted_demand NUMERIC NOT NULL,
    recommended_stock INTEGER NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved'))
);
`;

async function setupDatabase() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("Executing SQL to create tables...");
    await client.query(createTablesSQL);
    
    console.log("✅ Tables created successfully!");
  } catch (err) {
    console.error("❌ Error setting up database:", err.message);
  } finally {
    await client.end();
  }
}

setupDatabase();
