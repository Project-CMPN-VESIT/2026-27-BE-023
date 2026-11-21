const supabase = require('../config/db');

// Centralized Alert Generation Helper
async function triggerAlert(brand, alertDetails, broadcast) {
  try {
    const alertId = `ALT-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Check if an identical unread alert already exists to prevent duplication flooding
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('title', alertDetails.title)
      .eq('brand', brand)
      .eq('status', 'unread')
      .maybeSingle();

    if (existing) return null; // Already alerted, skip

    // Insert alert into Supabase
    const { data: insertedAlert, error } = await supabase
      .from('alerts')
      .insert([{
        alert_id: alertId,
        title: alertDetails.title,
        message: alertDetails.message,
        description: alertDetails.description,
        severity: alertDetails.severity || 'Low',
        module: alertDetails.module || 'Inventory',
        entity_id: alertDetails.entity_id || null,
        entity_type: alertDetails.entity_type || null,
        status: 'unread',
        action_required: alertDetails.action_required || null,
        brand: brand
      }])
      .select()
      .single();

    if (error) {
      console.error(`[Alert Engine] Failed to insert alert:`, error.message);
      return null;
    }

    console.log(`[Alert Engine] ⚡️ Alert Triggered: ${alertDetails.title} (${alertDetails.severity})`);
    
    // Broadcast via WebSockets in real-time
    if (broadcast) {
      broadcast('ALERT_TRIGGERED', insertedAlert);
    }

    return insertedAlert;
  } catch (err) {
    console.error(`[Alert Engine] Exception in triggerAlert:`, err.message);
    return null;
  }
}

// 1. Monitor Inventory Stock Levels
async function monitorInventory(brand, broadcast) {
  try {
    const { data: products } = await supabase.from('products').select('*').eq('brand', brand);
    if (!products) return;

    for (const p of products) {
      const isOut = p.current_stock === 0;
      const isLow = p.current_stock < p.threshold;

      if (isOut) {
        await triggerAlert(brand, {
          title: `OUT OF STOCK: ${p.name}`,
          message: `Product lot ${p.name} is completely depleted.`,
          description: `Active B2B carton inventory is 0. Safety threshold: ${p.threshold}. Customers are experiencing stockout.`,
          severity: 'Critical',
          module: 'Inventory',
          entity_id: p.product_id,
          entity_type: 'product',
          action_required: `Urgently draft a replenishment Purchase Order (PO) to restock lot ${p.name}.`
        }, broadcast);
      } else if (isLow) {
        await triggerAlert(brand, {
          title: `Low Stock: ${p.name}`,
          message: `Product ${p.name} stock has fallen below dynamic safety limit.`,
          description: `Current stock level is ${p.current_stock} cartons. Safe low-stock safety boundary is ${p.threshold}.`,
          severity: 'High',
          module: 'Inventory',
          entity_id: p.product_id,
          entity_type: 'product',
          action_required: `Draft a purchase order for restocking lot ${p.name} (recommended replenishment: 24 cartons).`
        }, broadcast);
      }
    }
  } catch (err) {
    console.error(`[Alert Engine] Inventory monitor failed:`, err.message);
  }
}

// 2. Monitor Staff Attendance & Salaries
async function monitorStaff(brand, broadcast) {
  try {
    // Check pending salary dues
    const { data: employees } = await supabase.from('employees').select('id, full_name').eq('brand', brand);
    if (!employees || employees.length === 0) return;

    const employeeIds = employees.map(e => e.id);
    
    // Check salary records with pending dues
    const { data: salRecords } = await supabase
      .from('salary_records')
      .select('*')
      .in('employee_id', employeeIds)
      .gt('pending_dues', 0);

    if (salRecords && salRecords.length > 0) {
      const count = salRecords.length;
      const totalDues = salRecords.reduce((sum, r) => sum + Number(r.pending_dues), 0);
      
      await triggerAlert(brand, {
        title: 'Salary Payments Outstanding',
        message: `Outstanding payroll dues registered for ${count} staff members.`,
        description: `Total unpaid B2B salary balance is ₹${totalDues.toLocaleString()}. Ledgers marked as Partial or Unpaid need settlement.`,
        severity: 'High',
        module: 'Staff',
        entity_id: 'Salary-Ledger',
        entity_type: 'employee',
        action_required: `Navigate to Staff Payroll Ledger and disburse pending balances via bank transfer/cash.`
      }, broadcast);
    }
  } catch (err) {
    console.error(`[Alert Engine] Staff monitor failed:`, err.message);
  }
}

// 3. Monitor Outstanding Purchase Orders
async function monitorPurchaseOrders(brand, broadcast) {
  try {
    // Find all 'Sent' purchase orders created more than 48 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('brand', brand)
      .eq('status', 'Sent')
      .lt('created_at', twoDaysAgo);

    if (pos && pos.length > 0) {
      for (const po of pos) {
        await triggerAlert(brand, {
          title: `Delayed Restocking: ${po.po_number}`,
          message: `Purchase Order ${po.po_number} outstanding for more than 48 hours.`,
          description: `PO ${po.po_number} has not been received. Delivery time exceeds standard B2B logistics SLAs.`,
          severity: 'Medium',
          module: 'Purchase Orders',
          entity_id: po.id,
          entity_type: 'purchase_order',
          action_required: `Contact active vendor representative to verify shipment tracking or record inventory carton receipt.`
        }, broadcast);
      }
    }
  } catch (err) {
    console.error(`[Alert Engine] PO monitor failed:`, err.message);
  }
}

// 4. Centralized Run All Monitors
async function runAllMonitors(brand, broadcast) {
  console.log(`[Alert Engine] Running background systems audit for brand '${brand}'...`);
  await Promise.all([
    monitorInventory(brand, broadcast),
    monitorStaff(brand, broadcast),
    monitorPurchaseOrders(brand, broadcast)
  ]);
  console.log(`[Alert Engine] Systems audit complete!`);
}

// Main Initialization Routine
function initializeAlertEngine(app) {
  console.log(`[Alert Engine] Centralized Alert & Notifications Service loaded successfully.`);
  
  // Set up periodic monitoring cycle (e.g. every 5 minutes)
  const monitorInterval = setInterval(async () => {
    try {
      const broadcast = app.get('broadcast');
      
      // Monitor Apparel & Fashion on background cycle
      await runAllMonitors('Apparel & Fashion', broadcast);
    } catch (err) {
      console.error(`[Alert Engine] Error in monitoring cycle:`, err.message);
    }
  }, 5 * 60 * 1000);

  // Expose trigger and run functions to router
  app.set('alertEngine', {
    runAllMonitors,
    triggerAlert
  });
}

module.exports = {
  initializeAlertEngine,
  runAllMonitors,
  triggerAlert
};
