const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing DB_PASSWORD or SUPABASE_URL in .env");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({ connectionString });

// Standard EAN-13 generator (200 prefix + 9 random digits + 1 checksum digit)
function generateEAN13() {
  const code = '200' + Math.floor(100000000 + Math.random() * 900000000).toString(); // 12 digits
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    if (i % 2 === 0) {
      oddSum += digit; // index 0, 2, 4, 6, 8, 10
    } else {
      evenSum += digit; // index 1, 3, 5, 7, 9, 11
    }
  }
  const total = oddSum + (evenSum * 3);
  const checkDigit = (10 - (total % 10)) % 10;
  return code + checkDigit.toString();
}

async function runMigration() {
  try {
    console.log("Connecting to Supabase PostgreSQL at:", dbHost);
    await client.connect();

    console.log("Applying schema modifications...");
    
    // 1. Add barcode column to products table
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
    `);
    console.log("✅ Column 'barcode' added/verified in products table.");

    // 2. Create barcode_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS barcode_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          username TEXT NOT NULL,
          product_id TEXT REFERENCES products(product_id) ON DELETE CASCADE,
          action_type TEXT NOT NULL CHECK (action_type IN ('view', 'receive', 'dispatch', 'transfer')),
          quantity_changed INTEGER DEFAULT 0,
          resulting_stock INTEGER DEFAULT 0,
          details TEXT,
          brand TEXT NOT NULL
      );
    `);
    console.log("✅ Table 'barcode_logs' created/verified.");

    // 3. Fetch all products without barcodes and bulk-generate valid EAN-13 ones
    console.log("Fetching products that lack a barcode...");
    const { rows: products } = await client.query(`
      SELECT id, product_id, name, brand FROM products WHERE barcode IS NULL OR barcode = '';
    `);

    console.log(`Found ${products.length} products needing barcodes.`);

    for (const p of products) {
      const newBarcode = generateEAN13();
      await client.query(`
        UPDATE products SET barcode = $1 WHERE id = $2;
      `, [newBarcode, p.id]);
      console.log(`- Assigned barcode [${newBarcode}] to product: "${p.name}" (Brand: ${p.brand})`);
    }

    console.log("⭐️ Schema migration & bulk-seeding completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
