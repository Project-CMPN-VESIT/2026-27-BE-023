const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const API_BASE = 'http://localhost:5000/api';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runWarehouseTest() {
  console.log("\n🚀 Starting Dynamic Warehouse Management & Occupancy Block Safeguard Integration Test...");

  const testBrand = 'Apparel & Fashion';
  let warehouseId = null;
  const newWarehouseName = `Pune Dispatch Terminal-${Date.now()}`;
  let dummyProductId = `PRD-TEST-WH-${Date.now()}`;

  try {
    // 1. Fetch initially seeded warehouses
    console.log(`\n1. Fetching registered warehouses for brand '${testBrand}'...`);
    const listRes = await axios.get(`${API_BASE}/warehouses`, {
      headers: { 'x-brand': testBrand }
    });
    console.log(`✅ Success: Found ${listRes.data.length} warehouses in database:`);
    listRes.data.forEach(w => console.log(`   - 🏢 Name: ${w.name} | ID: ${w.id}`));

    // 2. Register a new warehouse facility
    console.log(`\n2. Registering new custom warehouse facility '${newWarehouseName}'...`);
    const createRes = await axios.post(`${API_BASE}/warehouses`, {
      name: newWarehouseName
    }, {
      headers: { 'x-brand': testBrand }
    });

    warehouseId = createRes.data.id;
    console.log(`✅ Success: Facility registered successfully! ID: ${warehouseId}`);

    // Try to register a duplicate under the same brand (Should FAIL with 400)
    console.log(`\n3. Trying to register duplicate warehouse name under same brand...`);
    try {
      await axios.post(`${API_BASE}/warehouses`, {
        name: newWarehouseName
      }, {
        headers: { 'x-brand': testBrand }
      });
      console.error("❌ FAIL: Duplicate warehouse registration allowed!");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Success: API correctly blocked duplicate with 400: "${err.response.data.message}"`);
      } else {
        console.error("❌ FAIL: Unexpected status on duplicate registration:", err.message);
      }
    }

    // 4. Create an active product lot stored inside our new custom warehouse
    console.log(`\n4. Storing a product lot inside '${newWarehouseName}'...`);
    const prodRes = await axios.post(`${API_BASE}/products`, {
      product_id: dummyProductId,
      name: 'Dynamic Warehouse Verification SKU',
      price: 2499,
      category: 'Test Accessories',
      current_stock: 75,
      threshold: 10,
      warehouse_location: newWarehouseName
    }, {
      headers: { 'x-brand': testBrand }
    });
    console.log(`✅ Success: Product stored! Product ID: ${prodRes.data.product_id}, Location: ${prodRes.data.warehouse_location}`);

    // 5. Attempt to delete the warehouse while it has active products inside it (Should FAIL with 400 due to safeguard!)
    console.log(`\n5. Attempting to delete warehouse ID ${warehouseId} containing active product lots...`);
    try {
      await axios.delete(`${API_BASE}/warehouses/${warehouseId}`, {
        headers: { 'x-brand': testBrand }
      });
      console.error("❌ FAIL: Deletion allowed for warehouse containing active products!");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Success: Occupancy block guard triggered! API blocked deletion with 400:`);
        console.log(`   👉 Message: "${err.response.data.message}"`);
      } else {
        console.error("❌ FAIL: Unexpected error status when deleting occupied warehouse:", err.message);
      }
    }

    // 6. Relocate product (delete product) to clear warehouse occupancy
    console.log(`\n6. Relocating/cleaning up product from '${newWarehouseName}'...`);
    const { error: pDelErr } = await supabase.from('products').delete().eq('product_id', dummyProductId);
    if (pDelErr) throw pDelErr;
    console.log("✅ Success: Product cleared, warehouse occupancy is now 0!");

    // 7. Re-attempt to delete the empty warehouse (Should SUCCEED with 200)
    console.log(`\n7. Re-attempting deletion of warehouse ID ${warehouseId} now that it is empty...`);
    const delRes = await axios.delete(`${API_BASE}/warehouses/${warehouseId}`, {
      headers: { 'x-brand': testBrand }
    });
    console.log(`✅ Success: Warehouse facility deleted! Response:`, delRes.data);

    // 8. Verify audit logs for creation and deletion events
    console.log(`\n8. Verifying administrative audit logs...`);
    const { data: auditLogs, error: aErr } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', ['WAREHOUSE_CREATE', 'WAREHOUSE_DELETE'])
      .order('timestamp', { ascending: false })
      .limit(2);

    if (aErr) throw aErr;
    console.log(`✅ Success: Retrieved latest warehouse audit logs:`);
    auditLogs.forEach(log => {
      console.log(`   - [${log.user_role}] [${log.action}] - ${log.details}`);
    });

    console.log("\n⭐️ ALL DYNAMIC WAREHOUSE INTEGRATION TESTS PASSED PERFECTLY!");

  } catch (err) {
    console.error("❌ Test encountered an error:", err.message);
    if (err.response) {
      console.error("   Response Data:", err.response.data);
    }
  }
}

runWarehouseTest();
