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

const schemaSQL = `
-- 1. Add brand column to target tables with default 'Apparel & Fashion'
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE damaged_stock ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Apparel & Fashion';

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_suppliers_brand ON suppliers(brand);
CREATE INDEX IF NOT EXISTS idx_sales_brand ON sales(brand);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_brand ON purchase_orders(brand);
CREATE INDEX IF NOT EXISTS idx_damaged_stock_brand ON damaged_stock(brand);
CREATE INDEX IF NOT EXISTS idx_predictions_brand ON predictions(brand);
CREATE INDEX IF NOT EXISTS idx_alerts_brand ON alerts(brand);
`;

async function runMigration() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("Applying multi-brand schema columns and indexes...");
    await client.query(schemaSQL);
    console.log("✅ Schema updated successfully!");

    // 3. Clear existing seeds so we can rebuild all 5 clean industries
    console.log("Cleaning up old seeded catalogs to apply clean multi-brand datasets...");
    await client.query(`DELETE FROM predictions;`);
    await client.query(`DELETE FROM damaged_stock;`);
    await client.query(`DELETE FROM alerts;`);
    await client.query(`DELETE FROM sales;`);
    await client.query(`DELETE FROM purchase_orders;`);
    await client.query(`DELETE FROM products;`);
    await client.query(`DELETE FROM suppliers;`);

    // 4. Seed Suppliers for all 5 industries
    const supplierList = [
      // Apparel & Fashion
      { name: 'Apparel Craft Ltd.', email: 'info@apparelcraft.com', phone: '+91 98765 43210', address: '102 Textiles Zone, Surat, Gujarat', brand: 'Apparel & Fashion' },
      { name: 'KnitWear Wholesale', email: 'orders@knitwear.in', phone: '+91 87654 32109', address: '405 Hosiery Lane, Ludhiana, Punjab', brand: 'Apparel & Fashion' },
      { name: 'EcoThreads & Co.', email: 'contact@ecothreads.com', phone: '+91 76543 21098', address: '78 Green Hub, Coimbatore, Tamil Nadu', brand: 'Apparel & Fashion' },

      // Electronics & Gadgets
      { name: 'ElectroMax Distributors', email: 'info@electromax.com', phone: '+91 99999 88888', address: '402 Tech Park, Bengaluru, Karnataka', brand: 'Electronics & Gadgets' },
      { name: 'Apex Chipset Corp', email: 'sales@apexchip.com', phone: '+91 88888 77777', address: '701 Silicon Tower, Hyderabad, Telangana', brand: 'Electronics & Gadgets' },
      { name: 'Global Optical Sensors', email: 'import@globaloptical.com', phone: '+91 77777 66666', address: '15 Optics Zone, Pune, Maharashtra', brand: 'Electronics & Gadgets' },

      // FMCG & Pantry
      { name: 'Heritage Agro Farms', email: 'supply@heritageagro.com', phone: '+91 99999 11111', address: 'Sector 4, Karnal, Haryana', brand: 'FMCG & Pantry' },
      { name: 'Nile Coffee Importers', email: 'beans@nilecoffee.in', phone: '+91 88888 22222', address: '12 Port Terminal, Kochi, Kerala', brand: 'FMCG & Pantry' },
      { name: 'Dairy Valley Coop', email: 'orders@dairyvalley.co', phone: '+91 77777 33333', address: '88 Anand Hub, Anand, Gujarat', brand: 'FMCG & Pantry' },

      // Pharma & Cosmetics
      { name: 'Lifecare Labs Ltd.', email: 'info@lifecare.com', phone: '+91 99999 44444', address: 'Baddi Industrial Area, Himachal Pradesh', brand: 'Pharma & Cosmetics' },
      { name: 'Natura Botanicals', email: 'support@naturabotanicals.com', phone: '+91 88888 55555', address: '55 Herb Park, Dehradun, Uttarakhand', brand: 'Pharma & Cosmetics' },
      { name: 'PureShield Hygiene', email: 'b2b@pureshield.in', phone: '+91 77777 66666', address: '12 Pharma Park, Ahmedabad, Gujarat', brand: 'Pharma & Cosmetics' },

      // Hardware & Power Tools
      { name: 'Apex Steel & Alloys', email: 'sales@apexsteel.com', phone: '+91 99999 55555', address: 'Industrial Area phase-2, Ludhiana, Punjab', brand: 'Hardware & Power Tools' },
      { name: 'EverTool Corp', email: 'support@evertool.in', phone: '+91 88888 66666', address: 'Textile Hub, Surat, Gujarat', brand: 'Hardware & Power Tools' },
      { name: 'SafeArmor Gear', email: 'b2b@safearmor.com', phone: '+91 77777 77777', address: '22 Safety Zone, Chennai, Tamil Nadu', brand: 'Hardware & Power Tools' }
    ];

    console.log("Seeding suppliers for all 5 brands...");
    const supplierIdsMap = {}; // Key: "Supplier Name", Value: UUID
    for (const sup of supplierList) {
      const res = await client.query(
        `INSERT INTO suppliers (name, email, phone, address, brand) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [sup.name, sup.email, sup.phone, sup.address, sup.brand]
      );
      supplierIdsMap[sup.name] = res.rows[0].id;
    }
    console.log("✅ Seeded suppliers count:", Object.keys(supplierIdsMap).length);

    // 5. Seed Products with their mapped supplier IDs
    const productsToInsert = [
      // Apparel & Fashion
      { product_id: 'PRD-APP-01', name: 'Oversized Hoodie', price: 1499, original_price: 1799, category: 'Men Wear', current_stock: 120, threshold: 15, warehouse_location: 'Rack 1A', brand: 'Apparel & Fashion', supplier: 'Apparel Craft Ltd.' },
      { product_id: 'PRD-APP-02', name: 'Cargo Pants', price: 1899, original_price: 1999, category: 'Men Wear', current_stock: 95, threshold: 15, warehouse_location: 'Rack 1B', brand: 'Apparel & Fashion', supplier: 'KnitWear Wholesale' },
      { product_id: 'PRD-APP-03', name: 'Graphic T-Shirt', price: 799, original_price: 899, category: 'Unisex', current_stock: 150, threshold: 20, warehouse_location: 'Rack 2A', brand: 'Apparel & Fashion', supplier: 'EcoThreads & Co.' },
      { product_id: 'PRD-APP-04', name: 'Denim Jacket', price: 2499, original_price: 2799, category: 'Women Wear', current_stock: 60, threshold: 10, warehouse_location: 'Rack 2B', brand: 'Apparel & Fashion', supplier: 'Apparel Craft Ltd.' },
      { product_id: 'PRD-APP-05', name: 'Joggers', price: 1299, original_price: 1499, category: 'Men Wear', current_stock: 110, threshold: 12, warehouse_location: 'Rack 1C', brand: 'Apparel & Fashion', supplier: 'KnitWear Wholesale' },
      { product_id: 'PRD-APP-06', name: 'Crop Top', price: 699, original_price: 799, category: 'Women Wear', current_stock: 90, threshold: 15, warehouse_location: 'Rack 2C', brand: 'Apparel & Fashion', supplier: 'EcoThreads & Co.' },

      // Electronics & Gadgets
      { product_id: 'PRD-ELEC-01', name: 'iPhone 15 Pro', price: 134999, original_price: 139999, category: 'Smartphones', current_stock: 85, threshold: 15, warehouse_location: 'Aisle A-1', brand: 'Electronics & Gadgets', supplier: 'ElectroMax Distributors' },
      { product_id: 'PRD-ELEC-02', name: 'MacBook Air M3', price: 114900, original_price: 119900, category: 'Laptops', current_stock: 40, threshold: 8, warehouse_location: 'Aisle B-2', brand: 'Electronics & Gadgets', supplier: 'Apex Chipset Corp' },
      { product_id: 'PRD-ELEC-03', name: 'Sony WH-1000XM5', price: 29990, original_price: 29990, category: 'Audio', current_stock: 120, threshold: 20, warehouse_location: 'Aisle C-3', brand: 'Electronics & Gadgets', supplier: 'Global Optical Sensors' },
      { product_id: 'PRD-ELEC-04', name: 'Apple Watch Series 9', price: 41900, original_price: 44900, category: 'Wearables', current_stock: 65, threshold: 12, warehouse_location: 'Aisle D-4', brand: 'Electronics & Gadgets', supplier: 'ElectroMax Distributors' },
      { product_id: 'PRD-ELEC-05', name: 'Logitech MX Master 3S', price: 9495, original_price: 9495, category: 'Accessories', current_stock: 150, threshold: 30, warehouse_location: 'Aisle E-5', brand: 'Electronics & Gadgets', supplier: 'Apex Chipset Corp' },
      { product_id: 'PRD-ELEC-06', name: 'Dell 27" 4K Monitor', price: 35900, original_price: 37900, category: 'Displays', current_stock: 30, threshold: 5, warehouse_location: 'Aisle F-6', brand: 'Electronics & Gadgets', supplier: 'Global Optical Sensors' },

      // FMCG & Pantry
      { product_id: 'PRD-FMCG-01', name: 'Organic Almond Milk', price: 299, original_price: 349, category: 'Dairy Alternatives', current_stock: 300, threshold: 50, warehouse_location: 'Cold Storage A', brand: 'FMCG & Pantry', supplier: 'Heritage Agro Farms' },
      { product_id: 'PRD-FMCG-02', name: 'Guatemalan Coffee Beans', price: 1249, original_price: 1249, category: 'Beverages', current_stock: 150, threshold: 25, warehouse_location: 'Dry Food Aisle 1', brand: 'FMCG & Pantry', supplier: 'Nile Coffee Importers' },
      { product_id: 'PRD-FMCG-03', name: 'Greek Yogurt (1kg)', price: 349, original_price: 399, category: 'Dairy', current_stock: 180, threshold: 30, warehouse_location: 'Cold Storage B', brand: 'FMCG & Pantry', supplier: 'Dairy Valley Coop' },
      { product_id: 'PRD-FMCG-04', name: 'Gluten-Free Oats', price: 450, original_price: 499, category: 'Bakery & Grains', current_stock: 220, threshold: 40, warehouse_location: 'Dry Food Aisle 2', brand: 'FMCG & Pantry', supplier: 'Heritage Agro Farms' },
      { product_id: 'PRD-FMCG-05', name: 'Organic Avocados (5pc)', price: 699, original_price: 799, category: 'Fresh Produce', current_stock: 80, threshold: 20, warehouse_location: 'Produce Rack 3', brand: 'FMCG & Pantry', supplier: 'Nile Coffee Importers' },

      // Pharma & Cosmetics
      { product_id: 'PRD-PHAR-01', name: 'Hydrating Face Serum', price: 1199, original_price: 1299, category: 'Skincare', current_stock: 140, threshold: 25, warehouse_location: 'Zone A-Shelf 3', brand: 'Pharma & Cosmetics', supplier: 'Lifecare Labs Ltd.' },
      { product_id: 'PRD-PHAR-02', name: 'Argan Oil Shampoo', price: 849, original_price: 849, category: 'Haircare', current_stock: 160, threshold: 30, warehouse_location: 'Zone A-Shelf 5', brand: 'Pharma & Cosmetics', supplier: 'Natura Botanicals' },
      { product_id: 'PRD-PHAR-03', name: 'Multivitamin Gummies', price: 699, original_price: 799, category: 'Wellness', current_stock: 250, threshold: 40, warehouse_location: 'Zone B-Shelf 1', brand: 'Pharma & Cosmetics', supplier: 'PureShield Hygiene' },
      { product_id: 'PRD-PHAR-04', name: 'Waterproof Bandages', price: 199, original_price: 249, category: 'First Aid', current_stock: 400, threshold: 50, warehouse_location: 'Zone C-Shelf 2', brand: 'Pharma & Cosmetics', supplier: 'Lifecare Labs Ltd.' },
      { product_id: 'PRD-PHAR-05', name: 'Organic Aloe Vera Gel', price: 349, original_price: 349, category: 'Skincare', current_stock: 200, threshold: 35, warehouse_location: 'Zone A-Shelf 4', brand: 'Pharma & Cosmetics', supplier: 'Natura Botanicals' },

      // Hardware & Power Tools
      { product_id: 'PRD-HARD-01', name: 'Cordless Drill 18V', price: 6499, original_price: 6999, category: 'Power Tools', current_stock: 70, threshold: 12, warehouse_location: 'Rack T-1', brand: 'Hardware & Power Tools', supplier: 'Apex Steel & Alloys' },
      { product_id: 'PRD-HARD-02', name: 'Socket Wrench Set (40pc)', price: 2899, original_price: 2999, category: 'Hand Tools', current_stock: 95, threshold: 15, warehouse_location: 'Rack T-3', brand: 'Hardware & Power Tools', supplier: 'EverTool Corp' },
      { product_id: 'PRD-HARD-03', name: 'Anti-Fog Safety Goggles', price: 399, original_price: 499, category: 'Safety Gear', current_stock: 300, threshold: 45, warehouse_location: 'Rack S-2', brand: 'Hardware & Power Tools', supplier: 'SafeArmor Gear' },
      { product_id: 'PRD-HARD-04', name: 'M10 Stainless Screws (500x)', price: 849, original_price: 999, category: 'Fasteners', current_stock: 450, threshold: 60, warehouse_location: 'Rack F-4', brand: 'Hardware & Power Tools', supplier: 'Apex Steel & Alloys' },
      { product_id: 'PRD-HARD-05', name: 'High-Visibility Vest', price: 249, original_price: 249, category: 'Safety Gear', current_stock: 250, threshold: 35, warehouse_location: 'Rack S-3', brand: 'Hardware & Power Tools', supplier: 'EverTool Corp' }
    ];

    console.log("Seeding products for all 5 brands...");
    for (const p of productsToInsert) {
      const supplierId = supplierIdsMap[p.supplier];
      await client.query(
        `INSERT INTO products (product_id, name, price, original_price, category, current_stock, threshold, warehouse_location, brand, supplier_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.product_id, p.name, p.price, p.original_price, p.category, p.current_stock, p.threshold, p.warehouse_location, p.brand, supplierId]
      );
    }
    console.log("✅ Seeded products count:", productsToInsert.length);

    // 6. Generate historical B2B sales data for each SKU to support XGBoost
    console.log("Generating historical B2B sales logs for all products...");
    const dateNow = new Date();
    let salesCount = 0;
    for (const p of productsToInsert) {
      for (let dayOffset = 1; dayOffset <= 12; dayOffset += Math.floor(Math.random() * 3) + 2) {
        const saleDate = new Date();
        saleDate.setDate(dateNow.getDate() - dayOffset);
        const saleId = `SAL-${p.product_id}-${dayOffset}-${Math.floor(Math.random() * 1000)}`;
        const qty = Math.floor(Math.random() * 14) + 4; // 4 to 17 sold

        await client.query(
          `INSERT INTO sales (sale_id, product_id, quantity_sold, date, brand) VALUES ($1, $2, $3, $4, $5)`,
          [saleId, p.product_id, qty, saleDate.toISOString(), p.brand]
        );
        salesCount++;
      }
    }
    console.log(`✅ Seeded historical sales logs count: ${salesCount}`);
    console.log("🚀 Multi-brand database upgrade complete! Wipes resolved safely.");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
