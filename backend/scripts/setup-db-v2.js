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

const alterAndCreateSQL = `
-- Create Users Table (for RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'warehouse_manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alter Products Table to add warehouse, supplier links, and original price
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'Mumbai Main Warehouse';
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Populate original_price if null
UPDATE products SET original_price = price WHERE original_price IS NULL;

-- Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Received')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Damaged/Returned Stock Table
CREATE TABLE IF NOT EXISTS damaged_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('returned', 'damaged')),
    reason TEXT NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Mock Users if they do not exist
-- Default password for all will be 'password123' (we'll store the hashed/plain text representation for mock ease, but let's hash it in the API or insert clean rows)
-- We will write code to seed users inside this script
`;

// Simple hash generator or placeholder to match auth flow
// Since bcryptjs is used in the app, we can insert bcrypt hashes for:
// admin -> password123 ($2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6)
// staff -> password123 ($2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6)
// manager -> password123 ($2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6)
const seedUsersSQL = `
INSERT INTO users (username, password_hash, role)
VALUES 
  ('admin', '$2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6', 'admin'),
  ('staff', '$2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6', 'staff'),
  ('manager', '$2b$10$reQIv/YXXKlJ5Z11AUvYIeA2thrH85ylhkaZHR/Qs1bkZRkje/go6', 'warehouse_manager')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
`;

const seedSuppliersSQL = `
INSERT INTO suppliers (name, email, phone, address)
VALUES
  ('Apparel Craft Ltd.', 'info@apparelcraft.com', '+91 98765 43210', '102 Textiles Zone, Surat, Gujarat'),
  ('KnitWear Wholesale', 'orders@knitwear.in', '+91 87654 32109', '405 Hosiery Lane, Ludhiana, Punjab'),
  ('EcoThreads & Co.', 'contact@ecothreads.com', '+91 76543 21098', '78 Green Hub, Coimbatore, Tamil Nadu')
ON CONFLICT DO NOTHING;
`;

async function upgradeDatabase() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("Applying database schema migrations...");
    await client.query(alterAndCreateSQL);
    console.log("Database schema successfully upgraded!");

    console.log("Seeding initial B2B users and vendors...");
    await client.query(seedUsersSQL);
    await client.query(seedSuppliersSQL);
    console.log("✅ Seeding complete! Mock credentials generated successfully.");
  } catch (err) {
    console.error("❌ Error setting up database v2:", err.message);
  } finally {
    await client.end();
  }
}

upgradeDatabase();
