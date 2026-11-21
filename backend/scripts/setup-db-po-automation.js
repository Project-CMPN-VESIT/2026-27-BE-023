const { Client } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD || DB_PASSWORD === 'YOUR_DATABASE_PASSWORD_HERE') {
  console.error("❌ ERROR: Please set your DB_PASSWORD in the .env file to run this script.");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({
  connectionString,
});

const migrationSQL = `
-- 1. Alter products table to add created_via_po flag
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_via_PO BOOLEAN DEFAULT FALSE;

-- 2. Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(product_id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    category TEXT,
    selling_price NUMERIC,
    barcode TEXT,
    description TEXT,
    brand TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create supplier_products table
CREATE TABLE IF NOT EXISTS supplier_products (
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(product_id) ON DELETE CASCADE,
    supplier_price NUMERIC NOT NULL,
    lead_time INTEGER DEFAULT 3,
    reliability_score NUMERIC DEFAULT 5.0,
    last_purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    brand TEXT NOT NULL,
    PRIMARY KEY (supplier_id, product_id)
);

-- 4. Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(product_id) ON DELETE CASCADE,
    movement_type TEXT CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER')),
    quantity INTEGER NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    brand TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Backfill existing purchase_orders into purchase_order_items
INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, brand)
SELECT po.id, po.product_id, p.name, po.quantity, COALESCE(p.original_price, p.price, 0), po.brand
FROM purchase_orders po
JOIN products p ON po.product_id = p.product_id
ON CONFLICT DO NOTHING;
`;

async function runMigration() {
  try {
    console.log(`🔌 Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("🛠️ Running database migration for PO automation...");
    await client.query(migrationSQL);
    console.log("✅ Database schema migrated and backfilled successfully!");
  } catch (err) {
    console.error("❌ Error setting up database for PO automation:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
