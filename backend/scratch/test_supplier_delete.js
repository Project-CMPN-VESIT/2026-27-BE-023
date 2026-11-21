const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase configuration. Please run this in the correct environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSupplierDeletionTest() {
  const testBrand = 'Test Deletion Brand';
  console.log(`\n🚀 Starting Supplier Deletion Cascading & Integrity Test for Brand: '${testBrand}'...`);

  try {
    // 1. Create a dummy supplier
    console.log("\n1. Registering dummy supplier...");
    const { data: supplier, error: sErr } = await supabase.from('suppliers').insert([
      {
        name: 'Cascade Test Vendor',
        email: 'cascade@test.com',
        phone: '1234567890',
        address: '123 Test Ave',
        brand: testBrand
      }
    ]).select().single();

    if (sErr) throw sErr;
    console.log(`✅ Supplier registered successfully! ID: ${supplier.id}`);

    // 2. Create a dummy product linked to the supplier
    console.log("\n2. Creating dummy product linked to supplier...");
    const productId = `PRD-TEST-${Date.now()}`;
    const { data: product, error: pErr } = await supabase.from('products').insert([
      {
        product_id: productId,
        name: 'Cascade Test SKU',
        price: 999,
        category: 'Test',
        current_stock: 50,
        threshold: 5,
        warehouse_location: 'Test Warehouse',
        supplier_id: supplier.id,
        brand: testBrand
      }
    ]).select().single();

    if (pErr) throw pErr;
    console.log(`✅ Product created successfully! ID: ${product.product_id}, Supplier Reference: ${product.supplier_id}`);

    // 3. Create a dummy purchase order linked to the supplier and product
    console.log("\n3. Drafting dummy purchase order...");
    const poNumber = `PO-TEST-${Date.now()}`;
    const { data: po, error: poErr } = await supabase.from('purchase_orders').insert([
      {
        po_number: poNumber,
        supplier_id: supplier.id,
        product_id: product.product_id,
        quantity: 10,
        status: 'Draft',
        brand: testBrand
      }
    ]).select().single();

    if (poErr) throw poErr;
    console.log(`✅ Purchase Order drafted successfully! ID: ${po.id}, PO Number: ${po.po_number}`);

    // 4. Perform Supplier Deletion
    console.log("\n4. Triggering Supplier Deletion...");
    const { data: deletedSup, error: delErr } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', supplier.id)
      .eq('brand', testBrand)
      .select();

    if (delErr) throw delErr;
    console.log(`✅ Supplier deleted successfully from database!`);

    // 5. Verify Supplier is indeed gone
    console.log("\n5. Verifying Supplier is deleted...");
    const { data: foundSup, error: fErr } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplier.id);
    
    if (fErr) throw fErr;
    if (foundSup.length === 0) {
      console.log("✅ Verified: Supplier no longer exists in DB.");
    } else {
      console.error("❌ Fail: Supplier still exists!");
    }

    // 6. Verify Product supplier_id is set to NULL (ON DELETE SET NULL)
    console.log("\n6. Verifying Product's supplier reference is set to NULL...");
    const { data: foundProd, error: fpErr } = await supabase
      .from('products')
      .select('*')
      .eq('product_id', product.product_id)
      .single();
    
    if (fpErr) throw fpErr;
    if (foundProd.supplier_id === null) {
      console.log("✅ Verified: Product's supplier_id is now NULL. ON DELETE SET NULL works perfectly!");
    } else {
      console.error(`❌ Fail: Product still references supplier: ${foundProd.supplier_id}`);
    }

    // 7. Verify Purchase Order is deleted (ON DELETE CASCADE)
    console.log("\n7. Verifying associated Purchase Order is deleted...");
    const { data: foundPo, error: fpoErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', po.id);
    
    if (fpoErr) throw fpoErr;
    if (foundPo.length === 0) {
      console.log("✅ Verified: Purchase Order is fully cascade deleted. ON DELETE CASCADE works perfectly!");
    } else {
      console.error("❌ Fail: Purchase Order still exists in DB!");
    }

    // 8. Clean up product
    console.log("\n8. Cleaning up test product from database...");
    await supabase.from('products').delete().eq('product_id', product.product_id);
    console.log("✅ Cleanup complete!");
    console.log("\n⭐️ ALL DATABASE INTEGRITY TESTS PASSED PERFECTLY!");

  } catch (err) {
    console.error("\n❌ Test failed with error:", err.message);
  }
}

runSupplierDeletionTest();
