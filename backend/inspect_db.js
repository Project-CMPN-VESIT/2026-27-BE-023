const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/db');

async function inspectDatabase() {
  try {
    console.log("Checking Supabase Products...");
    const { data: products, error: pError } = await supabase.from('products').select('*');
    if (pError) throw pError;

    console.log(`\nFound ${products.length} Products:`);
    products.forEach(p => {
      console.log(`- ID: ${p.product_id} | Name: ${p.name} | Category: ${p.category} | Price: ₹${p.price} | Stock: ${p.current_stock}`);
    });

    console.log("\nChecking Supabase Suppliers...");
    const { data: suppliers, error: sError } = await supabase.from('suppliers').select('*');
    if (sError) throw sError;

    console.log(`\nFound ${suppliers.length} Suppliers:`);
    suppliers.forEach(s => {
      console.log(`- ID: ${s.id} | Name: ${s.name} | Email: ${s.email}`);
    });

  } catch (err) {
    console.error("Error inspecting database:", err.message);
  }
}

inspectDatabase();
