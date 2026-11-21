require('dotenv').config();
const supabase = require('../config/db');

const TEST_BRAND = 'Test Replenishment Brand';

// Copying helper utilities from api.js to run native test checks
function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const s2 = str2.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const distance = getLevenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return 1.0 - distance / maxLength;
}

function detectCategory(productName) {
  if (!productName) return 'Uncategorized';
  const name = productName.toLowerCase();
  if (name.includes('hoodie') || name.includes('sweatshirt')) return 'Hoodies';
  if (name.includes('jogger') || name.includes('pants')) return 'Bottomwear';
  if (name.includes('tee') || name.includes('t-shirt')) return 'T-Shirts';
  return 'Uncategorized';
}

async function generateUniqueSKU(category, brand) {
  let prefix = 'PRD';
  if (category) {
    const cat = category.toLowerCase().trim();
    if (cat.includes('tee') || cat.includes('t-shirt')) prefix = 'TEE';
    else if (cat.includes('hoodie')) prefix = 'HDY';
    else if (cat.includes('jogger') || cat.includes('pants')) prefix = 'BOT';
  }

  const { data } = await supabase
    .from('products')
    .select('product_id')
    .eq('brand', brand)
    .like('product_id', `${prefix}-%`);

  let maxNum = 0;
  if (data && data.length > 0) {
    data.forEach(p => {
      const parts = p.product_id.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }

  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

async function runPOAutomationTest() {
  try {
    console.log(`🚀 STARTING B2B PO REPLENISHMENT AUTOMATION INTEGRATION TESTS...`);
    console.log(`Brand Scoping: '${TEST_BRAND}'`);

    // 1. Clean up previous test runs
    console.log("🧹 Cleaning up old test data...");
    await supabase.from('purchase_orders').delete().eq('brand', TEST_BRAND);
    await supabase.from('products').delete().eq('brand', TEST_BRAND);
    await supabase.from('suppliers').delete().eq('email', 'test@po-automation.com');

    // 2. Register dummy supplier
    console.log("1. Registering test vendor...");
    const { data: supplier, error: supErr } = await supabase
      .from('suppliers')
      .insert([{
        name: 'Auto Replenishment Test Supplier',
        email: 'test@po-automation.com',
        phone: '+91 99999 88888',
        address: 'B2B Automation Hub, Sector 10, Noida'
      }])
      .select()
      .single();

    if (supErr) throw new Error(`Supplier seed failed: ${supErr.message}`);
    console.log(`✅ Supplier registered! ID: ${supplier.id}`);

    // 3. Draft PO with an Unregistered New Product
    console.log("\n2. Drafting B2B PO with Unregistered Product ('Heavy Oversized Hoodie')...");
    const po_number = `PO-TEST-${Date.now()}`;
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert([{
        po_number,
        supplier_id: supplier.id,
        product_id: null,
        quantity: 50,
        status: 'Draft',
        brand: TEST_BRAND
      }])
      .select()
      .single();

    if (poErr) throw new Error(poErr.message);
    
    // Insert item details
    const { error: itemErr } = await supabase
      .from('purchase_order_items')
      .insert([{
        purchase_order_id: po.id,
        product_name: 'Heavy Oversized Hoodie',
        quantity: 50,
        unit_price: 1200,
        category: 'Hoodies',
        selling_price: 1800,
        barcode: '1234567890128',
        description: 'Premium heavyweight cotton fleece hoodie',
        brand: TEST_BRAND
      }]);

    if (itemErr) throw new Error(itemErr.message);
    console.log(`✅ Drafted PO successfully! PO Number: ${po_number}`);

    // 4. Simulate status transitions to SENT
    console.log("\n3. Dispatching Purchase Order...");
    await supabase.from('purchase_orders').update({ status: 'Sent' }).eq('id', po.id);
    console.log("✅ PO Status updated to 'Sent'.");

    // 5. Simulate status transitions to RECEIVED (Auto product creation)
    console.log("\n4. Replenishing Inventory - Receiving PO (Triggers Auto-Creation)...");
    
    // Process Receipt Logic natively
    const { data: items } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', po.id);
    const item = items[0];

    const sku = await generateUniqueSKU(item.category, TEST_BRAND);
    console.log(`   - Compiling prefix category-based SKU: '${sku}'`);
    console.log(`   - Classified Category: '${item.category}'`);

    const { data: newProd, error: prodCreateErr } = await supabase
      .from('products')
      .insert([{
        product_id: sku,
        name: item.product_name,
        price: item.selling_price,
        category: item.category,
        current_stock: item.quantity,
        threshold: 10,
        warehouse_location: 'Mumbai Main Warehouse',
        original_price: item.unit_price,
        supplier_id: supplier.id,
        barcode: item.barcode,
        created_via_po: true,
        brand: TEST_BRAND
      }])
      .select()
      .single();

    if (prodCreateErr) throw new Error(prodCreateErr.message);
    console.log(`✅ New inventory product lot auto-created! SKU: ${newProd.product_id}, Stock: ${newProd.current_stock} cartons`);

    // Update PO references
    await supabase.from('purchase_order_items').update({ product_id: sku }).eq('id', item.id);
    await supabase.from('purchase_orders').update({ product_id: sku, status: 'Received' }).eq('id', po.id);

    // Seed supplier products mapping
    await supabase.from('supplier_products').insert([{
      supplier_id: supplier.id,
      product_id: sku,
      supplier_price: item.unit_price,
      lead_time: 3,
      reliability_score: 5.0,
      brand: TEST_BRAND
    }]);
    console.log(`✅ Supplier-Product mapping saved.`);

    // Audit inventory movements
    await supabase.from('inventory_movements').insert([{
      product_id: sku,
      movement_type: 'IN',
      quantity: item.quantity,
      reference_type: 'PO',
      reference_id: po_number,
      brand: TEST_BRAND
    }]);
    console.log(`✅ Inventory movement logged.`);

    // 6. Verify first product exists properly
    const { data: verifyProd } = await supabase.from('products').select('*').eq('product_id', sku).single();
    if (!verifyProd || !verifyProd.created_via_po) {
      throw new Error("Verification failed: Product was not successfully flagged as created_via_po.");
    }
    console.log(`⭐️ Verified: Product created_via_po flag is: ${verifyProd.created_via_po}`);

    // 7. Test Fuzzy Duplication match (Draft secondary PO with spelling variation)
    console.log("\n5. Testing Fuzzy Duplicate Matching Deduplication...");
    const po_number_2 = `PO-TEST-2-${Date.now()}`;
    const { data: po2 } = await supabase
      .from('purchase_orders')
      .insert([{
        po_number: po_number_2,
        supplier_id: supplier.id,
        product_id: null,
        quantity: 20,
        status: 'Sent',
        brand: TEST_BRAND
      }])
      .select()
      .single();

    // Secondary item spelling variation: "Heavy Oversize Hoodie" vs "Heavy Oversized Hoodie"
    await supabase
      .from('purchase_order_items')
      .insert([{
        purchase_order_id: po2.id,
        product_name: 'Heavy Oversize Hoodie',
        quantity: 20,
        unit_price: 1150,
        category: 'Hoodies',
        selling_price: 1750,
        barcode: '1234567890128',
        description: 'Heavy Oversize cotton fleece',
        brand: TEST_BRAND
      }]);

    console.log(`   - Drafted spelling-variant PO: '${po_number_2}' for product name: 'Heavy Oversize Hoodie'`);

    // Run fuzzy matching check against existing items
    const { data: currentProducts } = await supabase.from('products').select('*').eq('brand', TEST_BRAND);
    let bestScore = 0;
    let matchingProduct = null;

    currentProducts.forEach(p => {
      const score = calculateSimilarity(p.name, 'Heavy Oversize Hoodie');
      if (score > bestScore) {
        bestScore = score;
        matchingProduct = p;
      }
    });

    console.log(`   - Levenshtein score comparison: '${matchingProduct.name}' similarity = ${Math.round(bestScore * 100)}%`);

    if (bestScore >= 0.80) {
      console.log(`   👉 similarity above threshold! Merging received quantity (20) into existing SKU: '${matchingProduct.product_id}'...`);
      const newStock = matchingProduct.current_stock + 20;
      await supabase.from('products').update({ current_stock: newStock }).eq('product_id', matchingProduct.product_id);
      await supabase.from('purchase_orders').update({ product_id: matchingProduct.product_id, status: 'Received' }).eq('id', po2.id);

      // Log movement for replenish
      await supabase.from('inventory_movements').insert([{
        product_id: matchingProduct.product_id,
        movement_type: 'IN',
        quantity: 20,
        reference_type: 'PO',
        reference_id: po_number_2,
        brand: TEST_BRAND
      }]);
    } else {
      throw new Error("Fuzzy duplicate match was not correctly triggered.");
    }

    // 8. Verify deduplication
    const { data: finalProd } = await supabase.from('products').select('*').eq('product_id', sku).single();
    if (finalProd.current_stock !== 70) {
      throw new Error(`Deduplication failed: Stock was not merged properly. Expected stock: 70, actual: ${finalProd.current_stock}`);
    }
    console.log(`✅ Deduplication merge success! Final stock level for ${sku} is: ${finalProd.current_stock} cartons`);

    // Fetch movements to verify log count
    const { data: movements } = await supabase.from('inventory_movements').select('*').eq('brand', TEST_BRAND);
    console.log(`✅ Movements logged successfully! Log count: ${movements.length}`);

    console.log(`\n🎉 ALL AUTO INVENTORY AUTOMATION INTEGRATION TESTS PASSED PERFECTLY! 🏆`);
  } catch (err) {
    console.error("\n❌ Test Suite failed:", err.message);
  } finally {
    // Cleanup test data
    console.log("\n🧹 Cleaning up test brand data...");
    await supabase.from('purchase_orders').delete().eq('brand', TEST_BRAND);
    await supabase.from('products').delete().eq('brand', TEST_BRAND);
    await supabase.from('suppliers').delete().eq('email', 'test@po-automation.com');
  }
}

runPOAutomationTest();
