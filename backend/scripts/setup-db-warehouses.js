const { Client } = require('pg');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing Supabase credentials in .env");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({
  connectionString,
});

const ddlSQL = `
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_brand_warehouse UNIQUE(name, brand)
);
`;

const seedSQL = `
-- Seed default warehouses for Apparel & Fashion
INSERT INTO warehouses (name, brand) VALUES 
('Mumbai Main Warehouse', 'Apparel & Fashion'),
('Surat Textiles Lot', 'Apparel & Fashion'),
('Ludhiana Hosiery Hub', 'Apparel & Fashion')
ON CONFLICT (name, brand) DO NOTHING;

-- Seed default warehouses for Electronics & Gadgets
INSERT INTO warehouses (name, brand) VALUES 
('Mumbai Main Warehouse', 'Electronics & Gadgets'),
('Bengaluru Tech Park', 'Electronics & Gadgets'),
('Chennai Hardware Depot', 'Electronics & Gadgets')
ON CONFLICT (name, brand) DO NOTHING;

-- Seed default warehouses for FMCG & Pantry
INSERT INTO warehouses (name, brand) VALUES 
('Mumbai Main Warehouse', 'FMCG & Pantry'),
('Cold Storage A', 'FMCG & Pantry'),
('Dry Food Aisle 1', 'FMCG & Pantry')
ON CONFLICT (name, brand) DO NOTHING;

-- Seed default warehouses for Pharma & Cosmetics
INSERT INTO warehouses (name, brand) VALUES 
('Mumbai Main Warehouse', 'Pharma & Cosmetics'),
('Zone A-Shelf 3', 'Pharma & Cosmetics'),
('Zone B-Shelf 1', 'Pharma & Cosmetics')
ON CONFLICT (name, brand) DO NOTHING;

-- Seed default warehouses for Hardware & Power Tools
INSERT INTO warehouses (name, brand) VALUES 
('Mumbai Main Warehouse', 'Hardware & Power Tools'),
('Rack T-1', 'Hardware & Power Tools'),
('Rack S-2', 'Hardware & Power Tools')
ON CONFLICT (name, brand) DO NOTHING;
`;

async function run() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();

    console.log("Applying database DDL migrations for Warehouses table...");
    await client.query(ddlSQL);
    console.log("✅ Warehouses table created successfully!");

    console.log("Seeding default warehouses for all standard brands...");
    await client.query(seedSQL);
    console.log("✅ Seed data successfully inserted!");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
