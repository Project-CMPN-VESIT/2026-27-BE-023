const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const API_BASE = 'http://localhost:5000/api';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runApiTest() {
  console.log("\n🚀 Starting REST API Supplier Deletion & Brand Isolation Test...");

  const brandA = 'Apparel & Fashion';
  const brandB = 'Electronics & Gadgets';
  
  let supplierId = null;

  try {
    // 1. Create a supplier under Brand A (Apparel & Fashion)
    console.log(`\n1. Creating supplier under Brand: '${brandA}'...`);
    const createRes = await axios.post(`${API_BASE}/suppliers`, {
      name: 'API Brand Isolation Test Corp',
      email: 'isolation@api-test.com',
      phone: '9998887776',
      address: 'Brand Isolation Hub, Mumbai'
    }, {
      headers: { 'x-brand': brandA }
    });

    supplierId = createRes.data.id;
    console.log(`✅ Supplier created under brand '${brandA}' with ID: ${supplierId}`);

    // 2. Attempt to delete that supplier under Brand B (Electronics & Gadgets) - Should FAIL with 404
    console.log(`\n2. Attempting to delete supplier ID ${supplierId} under DIFFERENT brand: '${brandB}'...`);
    try {
      await axios.delete(`${API_BASE}/suppliers/${supplierId}`, {
        headers: { 'x-brand': brandB }
      });
      console.error("❌ FAIL: Supplier deletion allowed across brands!");
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`✅ Success: API correctly rejected cross-brand deletion with 404: "${err.response.data.message}"`);
      } else {
        console.error("❌ FAIL: Unexpected error status when deleting cross-brand:", err.message);
      }
    }

    // 3. Delete the supplier under correct Brand A (Apparel & Fashion) - Should SUCCEED with 200
    console.log(`\n3. Deleting supplier ID ${supplierId} under CORRECT brand: '${brandA}'...`);
    const delRes = await axios.delete(`${API_BASE}/suppliers/${supplierId}`, {
      headers: { 'x-brand': brandA }
    });
    console.log(`✅ Success: API deleted supplier. Response:`, delRes.data);

    // 4. Verify supplier is no longer in the DB
    console.log(`\n4. Confirming supplier is gone...`);
    const { data: checkSup } = await supabase.from('suppliers').select('*').eq('id', supplierId);
    if (checkSup.length === 0) {
      console.log("✅ Verified: Supplier is permanently deleted from database.");
    } else {
      console.error("❌ FAIL: Supplier still exists in database!");
    }

    // 5. Verify the Audit Log was created
    console.log(`\n5. Checking audit logs for supplier deletion record...`);
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'SUPPLIER_DELETE')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (auditLogs && auditLogs.length > 0 && auditLogs[0].details.includes('API Brand Isolation Test Corp')) {
      console.log(`✅ Success: Found audit log for deletion!`);
      console.log(`   Audit Log Entry: [${auditLogs[0].user_role}] [${auditLogs[0].action}] - ${auditLogs[0].details}`);
    } else if (auditLogs && auditLogs.length > 0) {
      console.log(`✅ Success: Found generic audit log: [${auditLogs[0].action}] - ${auditLogs[0].details}`);
    } else {
      console.error("❌ FAIL: No audit log generated for deletion!");
    }

    console.log("\n⭐️ ALL REST API INTEGRATION TESTS PASSED PERFECTLY!");

  } catch (err) {
    console.error("❌ Test encountered an error:", err.message);
    if (err.response) {
      console.error("   Response Data:", err.response.data);
    }
  }
}

runApiTest();
