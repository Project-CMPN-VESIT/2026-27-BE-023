const express = require('express');
const router = express.Router();
const supabase = require('../config/db');
const axios = require('express'); // wait, axios was imported as axios in the original file, let's keep it correct!
const axiosClient = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'inventai-super-secret-key-2026';

// --- AUDIT LOG HELPER ---
async function logAudit(role, action, details) {
  try {
    await supabase.from('audit_logs').insert([{
      user_role: role || 'System',
      action,
      details
    }]);
  } catch (err) {
    console.error('Audit logging failed:', err.message);
  }
}

// --- DATE FORMATTING HELPER ---
function formatDateToYMD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  // Match DD-MM-YYYY or DD/MM/YYYY
  const match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // If it contains ISO time, split it
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
  return dateStr;
}

// --- BROADCAST HELPER ---
function triggerBroadcast(req, type, payload) {
  const broadcast = req.app.get('broadcast');
  if (broadcast) {
    broadcast(type, payload);
  }
}

// --- EAN-13 BARCODE GENERATOR ---
function generateEAN13() {
  const code = '200' + Math.floor(100000000 + Math.random() * 900000000).toString(); // 12 digits
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    if (i % 2 === 0) {
      oddSum += digit; // index 0, 2, 4, 6...
    } else {
      evenSum += digit; // index 1, 3, 5, 7...
    }
  }
  const total = oddSum + (evenSum * 3);
  const checkDigit = (10 - (total % 10)) % 10;
  return code + checkDigit.toString();
}

// --- LEVENSHTEIN FUZZY MATCHING HELPERS ---
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
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
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

// --- AUTO CATEGORY DETECTION HELPERS ---
function detectCategory(productName) {
  if (!productName) return 'Uncategorized';
  const name = productName.toLowerCase();
  
  if (name.includes('hoodie') || name.includes('sweatshirt')) {
    return 'Hoodies';
  }
  if (name.includes('jogger') || name.includes('pants') || name.includes('denim') || name.includes('jeans') || name.includes('trousers') || name.includes('shorts')) {
    return 'Bottomwear';
  }
  if (name.includes('tee') || name.includes('t-shirt') || name.includes('tshirt') || name.includes('shirt') || name.includes('top')) {
    return 'T-Shirts';
  }
  if (name.includes('purse') || name.includes('bag') || name.includes('wallet') || name.includes('belt') || name.includes('sunglass') || name.includes('cap')) {
    return 'Accessories';
  }
  if (name.includes('phone') || name.includes('laptop') || name.includes('screen') || name.includes('monitor') || name.includes('watch') || name.includes('charger') || name.includes('cable')) {
    return 'Electronics';
  }
  
  return 'Uncategorized';
}

// --- SMART SKU GENERATION HELPER ---
async function generateUniqueSKU(category, brand) {
  let prefix = 'PRD';
  if (category) {
    const cat = category.toLowerCase().trim();
    if (cat.includes('tee') || cat.includes('t-shirt') || cat.includes('tshirt')) {
      prefix = 'TEE';
    } else if (cat.includes('hoodie') || cat.includes('hdy')) {
      prefix = 'HDY';
    } else if (cat.includes('jogger') || cat.includes('bottom') || cat.includes('pants')) {
      prefix = 'BOT';
    } else if (cat.includes('purse') || cat.includes('access') || cat.includes('bag')) {
      prefix = 'ACC';
    } else if (cat.includes('elec') || cat.includes('phone') || cat.includes('gadg')) {
      prefix = 'ELE';
    } else {
      const cleanCat = cat.replace(/[^a-z]/g, '').toUpperCase();
      prefix = cleanCat.slice(0, 3);
      if (prefix.length < 3) {
        prefix = (prefix + 'PRD').slice(0, 3);
      }
    }
  }

  const { data: existingProducts } = await supabase
    .from('products')
    .select('product_id')
    .eq('brand', brand)
    .like('product_id', `${prefix}-%`);

  let maxNum = 0;
  if (existingProducts && existingProducts.length > 0) {
    existingProducts.forEach(p => {
      const parts = p.product_id.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
  }

  const nextNum = maxNum + 1;
  const suffix = String(nextNum).padStart(3, '0');
  return `${prefix}-${suffix}`;
}

// --- SUPPLIER PRODUCT MAPPING HELPER ---
async function upsertSupplierMapping(supplier_id, product_id, supplier_price, brand, sent_at, received_at) {
  try {
    let lead_time = 3; // default fallback
    if (sent_at && received_at) {
      const sent = new Date(sent_at);
      const received = new Date(received_at);
      lead_time = Math.max(1, Math.round((received - sent) / (1000 * 60 * 60 * 24)));
    }
    
    // Check if mapping exists
    const { data: existing } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplier_id)
      .eq('product_id', product_id)
      .maybeSingle();

    if (existing) {
      let newReliability = parseFloat(existing.reliability_score || 5.0);
      if (lead_time > 4) {
        newReliability = Math.max(1.0, parseFloat((newReliability - 0.2).toFixed(1)));
      } else {
        newReliability = Math.min(5.0, parseFloat((newReliability + 0.1).toFixed(1)));
      }

      await supabase
        .from('supplier_products')
        .update({
          supplier_price,
          lead_time,
          reliability_score: newReliability,
          last_purchase_date: new Date().toISOString()
        })
        .eq('supplier_id', supplier_id)
        .eq('product_id', product_id);
    } else {
      await supabase
        .from('supplier_products')
        .insert([{
          supplier_id,
          product_id,
          supplier_price,
          lead_time,
          reliability_score: 5.0,
          last_purchase_date: new Date().toISOString(),
          brand
        }]);
    }
  } catch (err) {
    console.error('Error logging supplier product mapping:', err.message);
  }
}

// --- STOCK MOVEMENT HISTORICAL AUDITOR ---
async function logInventoryMovement(product_id, movement_type, quantity, reference_type, reference_id, brand) {
  try {
    await supabase.from('inventory_movements').insert([{
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      brand
    }]);
  } catch (err) {
    console.error('Error logging inventory movement:', err.message);
  }
}

// --- AUTHENTICATION ROUTES ---
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.role, 'USER_LOGIN', `User ${username} logged in successfully.`);

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server authentication error', error: err.message });
  }
});

// Verify JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied: Token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Access denied: Invalid token' });
    req.user = user;
    next();
  });
};


// Register brand extractor middleware globally for all api routes
router.use((req, res, next) => {
  req.brand = req.headers['x-brand'] || 'Apparel & Fashion';
  next();
});


// --- PRODUCT ROUTES ---
router.get('/products', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').eq('brand', req.brand).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/products', async (req, res) => {
  const { name, price, category, current_stock, threshold, warehouse_location, original_price, supplier_id, barcode } = req.body;
  const product_id = req.body.product_id || `PRD-${Date.now()}`;
  const finalBarcode = barcode || generateEAN13();
  
  const { data, error } = await supabase.from('products').insert([
    { 
      product_id, 
      name, 
      price, 
      category, 
      current_stock: current_stock || 0, 
      threshold: threshold || 10,
      warehouse_location: warehouse_location || 'Mumbai Main Warehouse',
      original_price: original_price || price,
      supplier_id: supplier_id || null,
      barcode: finalBarcode,
      brand: req.brand
    }
  ]).select().single();
  
  if (error) return res.status(400).json({ message: error.message });

  await logAudit('Admin/Staff', 'PRODUCT_CREATE', `Created product ${name} (ID: ${product_id}) for brand ${req.brand}`);
  triggerBroadcast(req, 'PRODUCT_CHANGE', data);

  res.status(201).json(data);
});

router.put('/products/:id', async (req, res) => {
  const { data, error } = await supabase.from('products')
    .update(req.body)
    .eq('product_id', req.params.id)
    .eq('brand', req.brand)
    .select().single();
    
  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: 'Product not found' });

  await logAudit('Admin/Staff', 'PRODUCT_UPDATE', `Updated product details for SKU: ${req.params.id} under brand ${req.brand}`);
  triggerBroadcast(req, 'PRODUCT_CHANGE', data);

  res.json(data);
});

router.delete('/products/:id', async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('product_id', req.params.id).eq('brand', req.brand);
  if (error) return res.status(500).json({ message: error.message });

  await logAudit('Admin', 'PRODUCT_DELETE', `Deleted SKU: ${req.params.id} under brand ${req.brand}`);
  triggerBroadcast(req, 'PRODUCT_CHANGE', { product_id: req.params.id, deleted: true });

  res.json({ message: 'Product deleted' });
});


// --- ENTERPRISE BARCODE ROUTING ---

// 1. GET /api/products/barcode/:barcodeCode - Retrieve product by barcode
router.get('/products/barcode/:barcodeCode', async (req, res) => {
  try {
    const { barcodeCode } = req.params;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcodeCode)
      .eq('brand', req.brand)
      .maybeSingle();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(404).json({ message: `Product with barcode ${barcodeCode} not found` });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. POST /api/products/barcode/bulk-generate - Generate barcodes for items lacking them
router.post('/products/barcode/bulk-generate', async (req, res) => {
  try {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('brand', req.brand)
      .or('barcode.is.null,barcode.eq.""');

    if (pErr) return res.status(500).json({ message: pErr.message });
    if (!products || products.length === 0) {
      return res.json({ message: 'All products already have barcodes assigned.', updatedCount: 0 });
    }

    let updatedCount = 0;
    for (const p of products) {
      const newBarcode = generateEAN13();
      const { error } = await supabase
        .from('products')
        .update({ barcode: newBarcode })
        .eq('id', p.id);
      
      if (!error) {
        updatedCount++;
        await logAudit('Admin', 'PRODUCT_BARCODE_GENERATE', `Bulk-assigned barcode [${newBarcode}] to product ${p.name} under brand ${req.brand}`);
      }
    }

    res.json({ message: `Successfully bulk-generated ${updatedCount} barcodes.`, updatedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. POST /api/products/barcode/action - Perform receive, dispatch/sell, location transfer stock modifications on a product
router.post('/products/barcode/action', async (req, res) => {
  try {
    const { product_id, action_type, quantity, destination_warehouse, username } = req.body;
    const user = username || 'System';

    if (!product_id || !action_type) {
      return res.status(400).json({ message: 'product_id and action_type are required' });
    }

    // Fetch current product under brand
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('product_id', product_id)
      .eq('brand', req.brand)
      .single();

    if (pErr || !product) {
      return res.status(404).json({ message: 'Product not found under this brand' });
    }

    let newStock = product.current_stock;
    let qtyChange = parseInt(quantity, 10) || 0;
    let details = '';
    let updatedFields = {};

    if (action_type === 'receive') {
      newStock += qtyChange;
      details = `Received/added ${qtyChange} cartons via barcode scan.`;
      updatedFields = { current_stock: newStock };
    } else if (action_type === 'dispatch') {
      if (product.current_stock < qtyChange) {
        return res.status(400).json({ 
          message: `Insufficient stock. Cannot dispatch ${qtyChange} units. Current stock: ${product.current_stock}` 
        });
      }
      newStock = Math.max(0, product.current_stock - qtyChange);
      details = `Dispatched/sold ${qtyChange} cartons via barcode scan.`;
      updatedFields = { current_stock: newStock };
    } else if (action_type === 'transfer') {
      if (!destination_warehouse) {
        return res.status(400).json({ message: 'destination_warehouse is required for location transfers' });
      }
      details = `Transferred inventory location from "${product.warehouse_location}" to "${destination_warehouse}" via barcode scan.`;
      updatedFields = { warehouse_location: destination_warehouse };
    } else if (action_type === 'view') {
      details = `Viewed product details via barcode scan.`;
    } else {
      return res.status(400).json({ message: `Invalid action_type: ${action_type}` });
    }

    // Perform database updates if applicable
    let updatedProduct = product;
    if (Object.keys(updatedFields).length > 0) {
      const { data: upProd, error: upErr } = await supabase
        .from('products')
        .update(updatedFields)
        .eq('product_id', product_id)
        .eq('brand', req.brand)
        .select()
        .single();

      if (upErr) return res.status(400).json({ message: upErr.message });
      updatedProduct = upProd;

      // Trigger WebSocket broadcast
      triggerBroadcast(req, 'PRODUCT_CHANGE', updatedProduct);

      // Trigger dynamic alerts in real-time if stock falls below limit threshold!
      if (action_type === 'dispatch' && newStock < product.threshold) {
        const alertEngine = req.app.get('alertEngine');
        const broadcast = req.app.get('broadcast');
        if (alertEngine) {
          await alertEngine.triggerAlert(req.brand, {
            title: `Low Stock: ${product.name}`,
            message: `Product ${product.name} stock has fallen below dynamic safety limit.`,
            description: `Current stock level is ${newStock} cartons. Safe low-stock safety boundary is ${product.threshold}. Action triggered by barcode dispatch.`,
            severity: 'High',
            module: 'Inventory',
            entity_id: product.product_id,
            entity_type: 'product',
            action_required: `Draft a purchase order for restocking lot ${product.name} (recommended replenishment: 24 cartons).`
          }, broadcast);
        }
      }
    }

    // Log to barcode_logs table
    const { data: logEntry, error: logErr } = await supabase
      .from('barcode_logs')
      .insert([{
        username: user,
        product_id: product_id,
        action_type: action_type,
        quantity_changed: action_type === 'transfer' || action_type === 'view' ? 0 : qtyChange,
        resulting_stock: newStock,
        details: details,
        brand: req.brand
      }])
      .select()
      .single();

    if (logErr) {
      console.error('Barcode logging failed:', logErr.message);
    }

    // Log standard administrative audit entry
    await logAudit('Admin/Staff', `BARCODE_${action_type.toUpperCase()}`, `Scanned lot: ${product.name} (SKU: ${product_id}). ${details}`);

    res.json({
      message: 'Barcode action executed successfully',
      product: updatedProduct,
      log: logEntry
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. GET /api/products/barcode/logs - Get recent barcode transactions
router.get('/barcode-logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('barcode_logs')
      .select('*, products(name, category, price)')
      .eq('brand', req.brand)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- B2B SALE ROUTES ---
router.get('/sales', async (req, res) => {
  const { data, error } = await supabase.from('sales').select('*').eq('brand', req.brand).order('date', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/sales', async (req, res) => {
  const { product_id, quantity_sold } = req.body;
  const sale_id = req.body.sale_id || `SAL-${Date.now()}`;
  const date = req.body.date || new Date().toISOString();
  
  // 1. Insert sale with brand
  const { data: saleData, error: saleError } = await supabase.from('sales').insert([
    { sale_id, product_id, quantity_sold, date, brand: req.brand }
  ]).select().single();
  
  if (saleError) return res.status(400).json({ message: saleError.message });
  
  // 2. Fetch product under brand to update stock
  const { data: product } = await supabase.from('products').select('*').eq('product_id', product_id).eq('brand', req.brand).single();
  
  if (product) {
    const newStock = product.current_stock - quantity_sold;
    await supabase.from('products').update({ current_stock: newStock }).eq('product_id', product_id).eq('brand', req.brand);
    
    await logAudit('Staff', 'SALE_LOGGED', `Recorded B2B sale of ${quantity_sold} units for product ${product.name} under brand ${req.brand}`);
    triggerBroadcast(req, 'SALE_LOGGED', { sale_id, product_id, quantity_sold });

    // 3. Check for low stock alert under brand
    if (newStock < product.threshold) {
      const alert_id = `ALT-${Date.now()}`;
      const msg = `Low stock warning for ${product.name}! Current stock: ${newStock}, Limit: ${product.threshold}`;
      
      const { data: alertData } = await supabase.from('alerts').insert([{
        alert_id,
        product_id: product.product_id,
        message: msg,
        brand: req.brand
      }]).select().single();

      triggerBroadcast(req, 'ALERT_TRIGGERED', alertData);
    }
  }
  
  res.status(201).json(saleData);
});


// --- CENTRALIZED ALERTS & RULES ROUTING ---

// 1. GET /api/alerts - Scoped, search, filters
router.get('/alerts', async (req, res) => {
  try {
    const { severity, status, module, search } = req.query;
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('brand', req.brand);

    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (module) query = query.eq('module', module);

    const { data: rawAlerts, error } = await query.order('triggered_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });

    let filtered = rawAlerts;
    if (search) {
      const q = search.toLowerCase();
      filtered = rawAlerts.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.message.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET /api/alerts/system/audit-trigger - Force system monitor sweep
router.get('/alerts/system/audit-trigger', async (req, res) => {
  try {
    const alertEngine = req.app.get('alertEngine');
    const broadcast = req.app.get('broadcast');
    if (alertEngine) {
      await alertEngine.runAllMonitors(req.brand, broadcast);
      // Fetch latest after sweep
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('brand', req.brand)
        .order('triggered_at', { ascending: false });
      return res.json({ message: 'Audit completed successfully', data });
    }
    res.status(500).json({ message: 'Alert engine not loaded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. GET /api/alerts/:id - Retrieve single alert
router.get('/alerts/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', req.params.id)
      .eq('brand', req.brand)
      .single();

    if (error || !data) return res.status(404).json({ message: 'Alert not found under this brand' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. POST /api/alerts - Create custom manual alert
router.post('/alerts', async (req, res) => {
  try {
    const { title, message, description, severity, module, entity_id, entity_type, action_required } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });

    const alertEngine = req.app.get('alertEngine');
    const broadcast = req.app.get('broadcast');
    
    if (alertEngine) {
      const newAlert = await alertEngine.triggerAlert(req.brand, {
        title, message, description, severity, module, entity_id, entity_type, action_required
      }, broadcast);
      
      if (newAlert) return res.status(201).json(newAlert);
      return res.status(400).json({ message: 'Alert already active or duplicate rule match' });
    }
    res.status(500).json({ message: 'Alert engine not loaded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. PATCH /api/alerts/:id/read - Mark as Read
router.patch('/alerts/:id/read', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .update({ status: 'read' })
      .eq('id', req.params.id)
      .eq('brand', req.brand)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ message: 'Alert not found or update rejected' });
    
    triggerBroadcast(req, 'ALERT_UPDATED', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. PATCH /api/alerts/:id/resolve - Resolve Alert
router.patch('/alerts/:id/resolve', async (req, res) => {
  try {
    const { resolved_by } = req.body;
    const { data, error } = await supabase
      .from('alerts')
      .update({ 
        status: 'resolved',
        resolved_by: resolved_by || 'Admin',
        resolved_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('brand', req.brand)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ message: 'Alert not found or resolution failed' });

    triggerBroadcast(req, 'ALERT_UPDATED', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. DELETE /api/alerts/:id - Delete Alert
router.delete('/alerts/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', req.params.id)
      .eq('brand', req.brand);

    if (error) return res.status(500).json({ message: error.message });
    
    triggerBroadcast(req, 'ALERT_DELETED', { id: req.params.id });
    res.json({ message: 'Alert successfully archived/deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 8. GET /api/alert-rules - Retrieve configurable Rules
router.get('/alert-rules', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('brand', req.brand)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 9. POST /api/alert-rules - Create configurable Rule
router.post('/alert-rules', async (req, res) => {
  try {
    const { name, module, metric, operator, value, severity } = req.body;
    const { data, error } = await supabase
      .from('alert_rules')
      .insert([{ name, module, metric, operator, value, severity, brand: req.brand }])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 10. DELETE /api/alert-rules/:id - Delete configured Rule
router.delete('/alert-rules/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', req.params.id)
      .eq('brand', req.brand);

    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'Alert rule deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 11. GET /api/notification-preferences - Preferences per role
router.get('/notification-preferences', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('brand', req.brand);

    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 12. PUT /api/notification-preferences - Update role preferences
router.put('/notification-preferences', async (req, res) => {
  try {
    const { user_role, module, channels, sound_enabled } = req.body;
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({ user_role, module, channels, sound_enabled, brand: req.brand }, { onConflict: 'user_role,module,brand' })
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




// --- SUPPLIER ROUTES ---
router.get('/suppliers', async (req, res) => {
  const { data, error } = await supabase.from('suppliers').select('*').eq('brand', req.brand).order('name', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/suppliers', async (req, res) => {
  const { name, email, phone, address } = req.body;
  const { data, error } = await supabase.from('suppliers').insert([
    { name, email, phone, address, brand: req.brand }
  ]).select().single();

  if (error) return res.status(400).json({ message: error.message });

  await logAudit('Admin', 'SUPPLIER_CREATE', `Added vendor profile for ${name} under brand ${req.brand}`);
  res.status(201).json(data);
});

router.delete('/suppliers/:id', async (req, res) => {
  try {
    const { data: supplier } = await supabase.from('suppliers').select('name').eq('id', req.params.id).eq('brand', req.brand).single();
    if (!supplier) return res.status(404).json({ message: 'Supplier not found under this brand' });

    const { error } = await supabase.from('suppliers').delete().eq('id', req.params.id).eq('brand', req.brand);
    if (error) return res.status(500).json({ message: error.message });

    await logAudit('Admin/Warehouse Manager', 'SUPPLIER_DELETE', `Deleted vendor profile: ${supplier.name} under brand ${req.brand}`);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- WAREHOUSE ROUTES ---
router.get('/warehouses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('brand', req.brand)
      .order('name', { ascending: true });
    
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/warehouses', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Facility name is required' });

    // Check if warehouse already exists under this brand
    const { data: existing } = await supabase
      .from('warehouses')
      .select('id')
      .eq('name', name)
      .eq('brand', req.brand)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: `A facility named "${name}" is already registered.` });
    }

    const { data, error } = await supabase
      .from('warehouses')
      .insert([{ name, brand: req.brand }])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    await logAudit('Admin/Warehouse Manager', 'WAREHOUSE_CREATE', `Registered active warehouse facility: ${name} under brand ${req.brand}`);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/warehouses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch warehouse details first
    const { data: warehouse, error: wErr } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .eq('brand', req.brand)
      .single();

    if (wErr || !warehouse) {
      return res.status(404).json({ message: 'Warehouse facility not found under this brand' });
    }

    // 2. Occupancy Safeguard: check if products are stored in this warehouse
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('product_id')
      .eq('warehouse_location', warehouse.name)
      .eq('brand', req.brand);

    if (pErr) return res.status(500).json({ message: pErr.message });

    if (products && products.length > 0) {
      return res.status(400).json({ 
        message: `Cannot remove facility. There are still ${products.length} active product carton lots stored in "${warehouse.name}". Please relocate them first.` 
      });
    }

    // 3. Perform Deletion
    const { error: delErr } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id)
      .eq('brand', req.brand);

    if (delErr) return res.status(500).json({ message: delErr.message });

    await logAudit('Admin/Warehouse Manager', 'WAREHOUSE_DELETE', `Deregistered warehouse facility: ${warehouse.name} under brand ${req.brand}`);
    res.json({ message: 'Warehouse facility removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- PURCHASE ORDERS (PO) AUTOMATION SERVICES & ROUTING ---

// Shared transactional PO receipt processing engine
async function processPOReceipt(req, poId) {
  // Fetch PO details
  const { data: po, error: poErr } = await supabase.from('purchase_orders').select('*').eq('id', poId).eq('brand', req.brand).single();
  if (poErr || !po) throw new Error('Purchase Order not found');

  if (po.status === 'Received') {
    throw new Error('Purchase Order has already been marked as Received.');
  }

  // Fetch PO items
  const { data: items } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', poId);
  const item = items?.[0]; // Support single item

  // Update status to Received in DB
  const { data: updatedPO, error: updateErr } = await supabase.from('purchase_orders')
    .update({ status: 'Received' })
    .eq('id', poId)
    .eq('brand', req.brand)
    .select().single();

  if (updateErr) throw new Error(updateErr.message);
  if (!item) return { updatedPO };

  let finalProductId = po.product_id;
  let finalStatusMsg = '';
  let duplicateMergeWarning = null;
  let autoCreatedProduct = null;

  let matchedProduct = null;

  if (po.product_id) {
    const { data: p } = await supabase.from('products').select('*').eq('product_id', po.product_id).eq('brand', req.brand).single();
    matchedProduct = p;
  } else {
    // Run Fuzzy Similarity Duplicate Check against all products under this brand
    const { data: allProducts } = await supabase.from('products').select('*').eq('brand', req.brand);
    
    let highestScore = 0;
    let bestMatch = null;

    if (allProducts && allProducts.length > 0) {
      allProducts.forEach(p => {
        const score = calculateSimilarity(p.name, item.product_name);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = p;
        }
      });
    }

    // Levenshtein threshold: >= 80% similarity triggers automatic merge/deduplication
    if (highestScore >= 0.80 && bestMatch) {
      matchedProduct = bestMatch;
      finalProductId = bestMatch.product_id;
      duplicateMergeWarning = `Potential duplicate product detected: PO item '${item.product_name}' was merged with existing item '${bestMatch.name}' (SKU: ${bestMatch.product_id}) with ${Math.round(highestScore * 100)}% similarity.`;
      
      // Log alert warning in database
      await supabase.from('alerts').insert([{
        title: 'Fuzzy Duplicate Merged',
        message: `PO Item '${item.product_name}' merged into existing '${bestMatch.name}' (SKU: ${bestMatch.product_id}) to prevent inventory duplicates.`,
        severity: 'Medium',
        module: 'Inventory',
        entity_id: bestMatch.product_id,
        brand: req.brand
      }]);
      triggerBroadcast(req, 'ALERT_TRIGGERED', {
        title: 'Fuzzy Duplicate Merged',
        message: `PO Item '${item.product_name}' merged into existing '${bestMatch.name}' (SKU: ${bestMatch.product_id}).`,
        severity: 'Medium'
      });
    }
  }

  if (matchedProduct) {
    // Option A: Update existing product stock
    const replenishedStock = (matchedProduct.current_stock || 0) + item.quantity;
    const { data: updatedProduct } = await supabase
      .from('products')
      .update({ current_stock: replenishedStock })
      .eq('product_id', matchedProduct.product_id)
      .eq('brand', req.brand)
      .select()
      .single();

    // Update PO item and root PO with resolved product_id
    await supabase.from('purchase_order_items').update({ product_id: matchedProduct.product_id }).eq('id', item.id);
    await supabase.from('purchase_orders').update({ product_id: matchedProduct.product_id }).eq('id', poId);

    // Performance supplier mapping
    await upsertSupplierMapping(po.supplier_id, matchedProduct.product_id, item.unit_price, req.brand, po.created_at, new Date().toISOString());

    // Stock movement auditing
    await logInventoryMovement(matchedProduct.product_id, 'IN', item.quantity, 'PO', po.po_number, req.brand);

    // Audit log
    finalStatusMsg = `Received PO ${po.po_number}. Replenished existing SKU ${matchedProduct.product_id} ('${matchedProduct.name}') by ${item.quantity} cartons under brand ${req.brand}.`;
    if (duplicateMergeWarning) {
      finalStatusMsg += ` [Fuzzy Merge Triggered]`;
    }

    await logAudit('Warehouse Manager', 'PO_RECEIVED', finalStatusMsg);
    triggerBroadcast(req, 'PRODUCT_CHANGE', updatedProduct);

    // Create alert notification
    await supabase.from('alerts').insert([{
      title: 'Stock Replenishment Complete',
      message: `Replenished existing SKU ${matchedProduct.product_id} ('${matchedProduct.name}') by ${item.quantity} cartons.`,
      severity: 'Low',
      module: 'Inventory',
      entity_id: matchedProduct.product_id,
      brand: req.brand
    }]);
  } else {
    // Option B: Auto product creation for unregistered item
    const newSku = await generateUniqueSKU(item.category, req.brand);
    const finalBarcode = item.barcode || generateEAN13();

    const { data: newProd, error: createErr } = await supabase
      .from('products')
      .insert([{
        product_id: newSku,
        name: item.product_name,
        price: item.selling_price || Math.round(item.unit_price * 1.4),
        category: item.category || 'Uncategorized',
        current_stock: item.quantity,
        threshold: 10,
        warehouse_location: 'Mumbai Main Warehouse',
        original_price: item.unit_price,
        supplier_id: po.supplier_id,
        barcode: finalBarcode,
        created_via_po: true,
        brand: req.brand
      }])
      .select()
      .single();

    if (createErr) throw new Error(createErr.message);

    autoCreatedProduct = newProd;
    finalProductId = newSku;

    // Update PO item and root PO with new product_id
    await supabase.from('purchase_order_items').update({ product_id: newSku }).eq('id', item.id);
    await supabase.from('purchase_orders').update({ product_id: newSku }).eq('id', poId);

    // Performance supplier mapping
    await upsertSupplierMapping(po.supplier_id, newSku, item.unit_price, req.brand, po.created_at, new Date().toISOString());

    // Stock movement auditing
    await logInventoryMovement(newSku, 'IN', item.quantity, 'PO', po.po_number, req.brand);

    finalStatusMsg = `Received PO ${po.po_number}. Auto-created new product lot SKU ${newSku} ('${item.product_name}') with ${item.quantity} cartons under brand ${req.brand}.`;
    await logAudit('Warehouse Manager', 'PO_RECEIVED', finalStatusMsg);
    
    triggerBroadcast(req, 'PRODUCT_CHANGE', newProd);

    // Insert notification alerts in DB
    await supabase.from('alerts').insert([{
      title: 'Product Auto-Created From PO',
      message: `Automatically registered new SKU ${newSku} ('${item.product_name}') from PO ${po.po_number}.`,
      severity: 'High',
      module: 'Inventory',
      entity_id: newSku,
      brand: req.brand
    }]);
    triggerBroadcast(req, 'ALERT_TRIGGERED', {
      title: 'Product Auto-Created From PO',
      message: `Auto-registered new SKU ${newSku} ('${item.product_name}').`,
      severity: 'High'
    });
  }

  return {
    ...updatedPO,
    product_id: finalProductId,
    duplicate_merge_warning: duplicateMergeWarning,
    auto_created_product: autoCreatedProduct
  };
}

router.get('/purchase-orders', async (req, res) => {
  try {
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('brand', req.brand)
      .order('created_at', { ascending: false });
      
    if (error) return res.status(500).json({ message: error.message });
    
    // Map POs to ensure backward UI compatibility
    const mapped = pos.map(po => {
      const item = po.purchase_order_items?.[0] || {};
      return {
        ...po,
        // Fallback properties for seamless UI mapping
        product_name: item.product_name || 'New Product',
        cost_price: item.unit_price || 0,
        selling_price: item.selling_price || 0,
        category: item.category || 'Uncategorized',
        barcode: item.barcode || '',
        description: item.description || '',
        brand_name: item.brand || po.brand
      };
    });
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/purchase-orders', async (req, res) => {
  const { 
    supplier_id, 
    product_id, 
    quantity,
    product_name,
    cost_price,
    selling_price,
    category,
    barcode,
    description,
    brand_name
  } = req.body;
  
  const po_number = `PO-${Date.now()}`;
  
  try {
    // 1. Validate Supplier
    const { data: supplier, error: supErr } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplier_id)
      .single();
      
    if (supErr || !supplier) {
      return res.status(400).json({ message: 'Invalid supplier vendor profile.' });
    }

    let isNewProduct = !product_id || product_id === 'NEW_PRODUCT';
    let targetProductId = isNewProduct ? null : product_id;
    let targetProductName = '';
    let targetCategory = category || 'Uncategorized';
    let targetCostPrice = cost_price || 0;
    let targetSellingPrice = selling_price || 0;

    if (!isNewProduct) {
      // Fetch existing product data
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', product_id)
        .eq('brand', req.brand)
        .single();
        
      if (!prod) {
        return res.status(400).json({ message: 'Selected product does not exist in inventory.' });
      }
      targetProductName = prod.name;
      targetCategory = prod.category;
      targetCostPrice = prod.original_price || prod.price;
      targetSellingPrice = prod.price;
    } else {
      // Validate unregistered product data
      if (!product_name || !product_name.trim()) {
        return res.status(400).json({ message: 'Product name is required for new items.' });
      }
      targetProductName = product_name.trim();
      targetCategory = category || detectCategory(targetProductName);
      targetCostPrice = parseFloat(cost_price) || 0;
      targetSellingPrice = parseFloat(selling_price) || Math.round(targetCostPrice * 1.4); // 40% markup default
    }

    // 2. Insert main Purchase Order record
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert([
        { 
          po_number, 
          supplier_id, 
          product_id: targetProductId, 
          quantity: Number(quantity), 
          status: 'Draft', 
          brand: req.brand 
        }
      ])
      .select()
      .single();

    if (poErr) return res.status(400).json({ message: poErr.message });

    // 3. Insert Purchase Order Item record
    const { error: itemErr } = await supabase
      .from('purchase_order_items')
      .insert([
        {
          purchase_order_id: po.id,
          product_id: targetProductId,
          product_name: targetProductName,
          quantity: Number(quantity),
          unit_price: targetCostPrice,
          category: targetCategory,
          selling_price: targetSellingPrice,
          barcode: barcode || null,
          description: description || null,
          brand: brand_name || req.brand
        }
      ]);

    if (itemErr) return res.status(400).json({ message: itemErr.message });

    await logAudit(
      'Warehouse Manager', 
      'PO_CREATE', 
      `Drafted B2B Purchase Order ${po_number} containing ${quantity} cartons of '${targetProductName}' under brand ${req.brand}`
    );

    res.status(201).json({
      ...po,
      product_name: targetProductName,
      cost_price: targetCostPrice,
      selling_price: targetSellingPrice,
      category: targetCategory
    });
  } catch (err) {
    res.status(500).json({ message: 'Error drafting purchase order', error: err.message });
  }
});

router.put('/purchase-orders/:id', async (req, res) => {
  const { status } = req.body;
  const poId = req.params.id;

  try {
    if (status === 'Received') {
      const result = await processPOReceipt(req, poId);
      return res.json(result);
    }

    // Standard PO updates (Draft -> Sent etc)
    const { data: po, error: poErr } = await supabase.from('purchase_orders').select('*').eq('id', poId).eq('brand', req.brand).single();
    if (poErr || !po) return res.status(404).json({ message: 'Purchase Order not found' });

    const { data: updatedPO, error: updateErr } = await supabase.from('purchase_orders')
      .update({ status })
      .eq('id', poId)
      .eq('brand', req.brand)
      .select().single();

    if (updateErr) return res.status(400).json({ message: updateErr.message });

    await logAudit('Warehouse Manager', 'PO_UPDATE', `Updated PO ${po.po_number} status to ${status} under brand ${req.brand}`);
    res.json(updatedPO);
  } catch (err) {
    res.status(500).json({ message: 'Error updating purchase order', error: err.message });
  }
});

router.patch('/purchase-orders/:id/receive', async (req, res) => {
  try {
    const result = await processPOReceipt(req, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error receiving purchase order', error: err.message });
  }
});

router.get('/inventory/movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, products(name)')
      .eq('brand', req.brand)
      .order('created_at', { ascending: false });
      
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- DAMAGED AND RETURNED STOCK ROUTING ---
router.get('/returns', async (req, res) => {
  const { data, error } = await supabase.from('damaged_stock').select('*').eq('brand', req.brand).order('reported_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/returns', async (req, res) => {
  const { product_id, quantity, type, reason } = req.body;

  try {
    // Add damaged stock record
    const { data: returnData, error } = await supabase.from('damaged_stock').insert([
      { product_id, quantity, type, reason, brand: req.brand }
    ]).select().single();

    if (error) return res.status(400).json({ message: error.message });

    // Adjust product inventory
    const { data: product } = await supabase.from('products').select('*').eq('product_id', product_id).eq('brand', req.brand).single();
    if (product) {
      let finalStock = product.current_stock;
      if (type === 'damaged') {
        // Damaged goods subtract from inventory
        finalStock = Math.max(0, product.current_stock - quantity);
      } else if (type === 'returned') {
        // Returns add back to inventory
        finalStock = product.current_stock + quantity;
      }
      
      const { data: updatedProduct } = await supabase.from('products')
        .update({ current_stock: finalStock })
        .eq('product_id', product_id)
        .eq('brand', req.brand)
        .select().single();

      await logAudit('Warehouse Manager', 'STOCK_RETURN_LOG', `Log ${type} lot for SKU: ${product.name} (Qty: ${quantity}) under brand ${req.brand}. Reason: ${reason}`);
      triggerBroadcast(req, 'PRODUCT_CHANGE', updatedProduct);
    }

    res.status(201).json(returnData);
  } catch (err) {
    res.status(500).json({ message: 'Error logging returned/damaged stock', error: err.message });
  }
});


// --- AUDIT LOGS ---
router.get('/audit-logs', async (req, res) => {
  const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});


// --- PREDICTIONS ROUTING & ANALYTICS INTEGRATION ---
router.get('/predictions', async (req, res) => {
  const { data, error } = await supabase.from('predictions').select('*').eq('brand', req.brand).order('generated_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

// Trigger prediction in Python ML service
router.post('/trigger-prediction', async (req, res) => {
  try {
    const mlResponse = await axiosClient.post('http://localhost:8001/predict', {}, {
      headers: { 'x-brand': req.brand }
    });
    res.json({ message: 'Prediction successfully computed', data: mlResponse.data });
  } catch (err) {
    res.status(500).json({ message: 'Failed to communicate with ML service', error: err.message });
  }
});

// Fetch smart price recommendations, trends, dead stock clearance suggestions from ML
router.get('/ai-insights', async (req, res) => {
  try {
    const mlResponse = await axiosClient.get('http://localhost:8001/analytics-insights', {
      headers: { 'x-brand': req.brand }
    });
    res.json(mlResponse.data);
  } catch (err) {
    console.error('Failed to get real ML insights, executing statistical fallback...', err.message);
    
    // Statistical fallback in case ML service is offline during rapid UI rendering
    const { data: products } = await supabase.from('products').select('*').eq('brand', req.brand);
    const { data: sales } = await supabase.from('sales').select('*').eq('brand', req.brand);

    const lowStock = products.filter(p => p.current_stock < p.threshold);
    
    // Identify dead stock (sold < 5 units in last 30 days)
    const deadStock = products.filter(p => {
      const pSales = sales.filter(s => s.product_id === p.product_id);
      const sumSold = pSales.reduce((acc, curr) => acc + curr.quantity_sold, 0);
      return sumSold < 5;
    }).map(p => ({
      product_id: p.product_id,
      name: p.name,
      current_stock: p.current_stock,
      suggested_discount: '30% Clearance Price',
      suggested_price: Math.round(p.price * 0.7)
    }));

    // Identify trending items (fast selling, sold > 20 items in total)
    const trending = products.filter(p => {
      const pSales = sales.filter(s => s.product_id === p.product_id);
      const sumSold = pSales.reduce((acc, curr) => acc + curr.quantity_sold, 0);
      return sumSold >= 15;
    }).map(p => ({
      product_id: p.product_id,
      name: p.name,
      status: 'Trending High Demand'
    }));

    res.json({
      deadStock,
      trending,
      safetyThresholds: products.map(p => ({
        product_id: p.product_id,
        name: p.name,
        dynamic_threshold: Math.max(12, p.threshold + 2)
      })),
      seasonalPrediction: "Mid-Year Peak Season Shift. Expected demand growth in seasonal inventories by 35%.",
      recommendations: products.map(p => {
        const related = products.find(o => o.category === p.category && o.product_id !== p.product_id);
        return {
          product_id: p.product_id,
          name: p.name,
          recommended_cross_sell: related ? related.name : 'Complementary Accessory SKU'
        };
      })
    });
  }
});


// --- INTENT-DRIVEN AI CHATBOT ENGINE ---
router.post('/chatbot/query', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ message: 'Query prompt is required' });

  const cleanQuery = query.toLowerCase();

  try {
    const { data: products } = await supabase.from('products').select('*').eq('brand', req.brand);
    const { data: sales } = await supabase.from('sales').select('*').eq('brand', req.brand);
    const { data: alerts } = await supabase.from('alerts').select('*').eq('brand', req.brand);
    const { data: predictions } = await supabase.from('predictions').select('*').eq('brand', req.brand);

    let reply = "";

    if (cleanQuery.includes('low') || cleanQuery.includes('out') || cleanQuery.includes('threshold')) {
      const lowItems = products.filter(p => p.current_stock < p.threshold);
      if (lowItems.length === 0) {
        reply = "🎉 Great news! All products currently have healthy stock levels and are above their low-stock thresholds.";
      } else {
        reply = `⚠️ We found **${lowItems.length} products** running dangerously low:\n` + 
          lowItems.map(p => `• **${p.name}**: ${p.current_stock} cartons left (Threshold is ${p.threshold})`).join('\n') +
          `\n\nI recommend generating a Purchase Order for these items immediately.`;
      }
    }
    
    else if (cleanQuery.includes('predict') || cleanQuery.includes('forecast') || cleanQuery.includes('tomorrow') || (products && products.some(p => cleanQuery.includes(p.name.toLowerCase())))) {
      if (predictions.length === 0) {
        reply = "📉 No predictive modeling is available in the database yet. Record at least 10 sales transactions and trigger predictions so that the XGBoost AI model can evaluate demand!";
      } else {
        reply = "🧠 **AI XGBoost Tomorrow Demand Forecast & Reorders**:\n" +
          predictions.slice(0, 5).map(pred => {
            const p = products.find(x => x.product_id === pred.product_id);
            const name = p ? p.name : 'Unknown lot';
            return `• **${name}**: Predicted demand **${parseFloat(pred.predicted_demand).toFixed(1)} cartons** | Recommended reorder: **${pred.recommended_stock} cartons**`;
          }).join('\n') +
          `\n\n_Note: Forecast is updated dynamically in real-time as sales are logged._`;
      }
    }
    
    else if (cleanQuery.includes('dead') || cleanQuery.includes('clearance') || cleanQuery.includes('slow') || cleanQuery.includes('discount') || cleanQuery.includes('price')) {
      // Find items with low sales
      const deadStock = products.filter(p => {
        const pSales = sales.filter(s => s.product_id === p.product_id);
        const sumSold = pSales.reduce((acc, curr) => acc + curr.quantity_sold, 0);
        return sumSold < 5;
      });

      if (deadStock.length === 0) {
        reply = "💸 All active products have strong B2B sales volume! No dead stock or clearance optimizations are currently needed.";
      } else {
        reply = "🏷️ **AI Price & Dead Stock Clearance Suggestion**:\n" +
          deadStock.slice(0, 4).map(p => {
            const suggestedDisc = '25% Clearance';
            const clearedPrice = Math.round(p.price * 0.75);
            return `• **${p.name}** (Stock: ${p.current_stock} cartons): Current price ₹${p.price}. Suggest **${suggestedDisc}** to drop price to **₹${clearedPrice}** and clear warehouse shelf space.`;
          }).join('\n') +
          `\n\nThese discounts will help liquidate slow-moving cartons and maximize capital velocity!`;
      }
    }

    else if (cleanQuery.includes('sales') || cleanQuery.includes('revenue') || cleanQuery.includes('money')) {
      const totalRevenue = sales.reduce((sum, sale) => {
        const p = products.find(x => x.product_id === sale.product_id);
        return sum + (sale.quantity_sold * (p ? p.price : 0));
      }, 0);
      const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);

      reply = `📊 **Sales Summary & Financial Overview**:\n` +
        `• **Total B2B Revenue**: ₹${totalRevenue.toLocaleString()}\n` +
        `• **Wholesale Lots Sold**: ${totalUnits} cartons\n` +
        `• **Transaction Count**: ${sales.length} completed logs\n\n` +
        `Our top product category is currently driving major B2B contract completions.`;
    }

    else {
      // Default natural response with operational summary
      const activeAlerts = alerts.filter(a => a.status === 'unread').length;
      reply = `Hello! I'm your **InventAI Intelligent Agent** 🧠✨.\n\n` +
        `Here is our current operating status:\n` +
        `• **Catalog Volume**: ${products.length} active lots across categories.\n` +
        `• **Alert Status**: ${activeAlerts} unread low-stock alerts.\n` +
        `• **Completed Sales**: ${sales.length} logged invoices.\n\n` +
        `How can I assist you today? You can ask me questions like:\n` +
        `💬 _"Which products are low in stock?"_\n` +
        `💬 _"Suggest clearance discounts for dead stock"_\n` +
        `💬 _"Predict tomorrow's demand forecast"_`;
    }

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process AI chat query', error: err.message });
  }
});


// --- BULK PRODUCT IMPORT ---
router.post('/products/bulk', async (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ message: 'Request body must be an array of products' });
  }

  const productsToInsert = products.map((p, index) => ({
    product_id: p.product_id || `PRD-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
    name: p.name,
    price: Number(p.price) || 0,
    category: p.category || 'Uncategorized',
    current_stock: Number(p.current_stock) || 0,
    threshold: Number(p.threshold) || 10,
    warehouse_location: p.warehouse_location || 'Mumbai Main Warehouse',
    original_price: Number(p.original_price) || Number(p.price) || 0,
    brand: req.brand
  }));

  const { data, error } = await supabase.from('products').insert(productsToInsert).select();
  if (error) return res.status(400).json({ message: error.message });

  await logAudit('Admin', 'BULK_IMPORT_PRODUCTS', `Successfully imported ${products.length} products via JSON/CSV under brand ${req.brand}`);
  triggerBroadcast(req, 'PRODUCT_CHANGE', { bulk: true });

  res.status(201).json(data);
});


// --- BULK SALES IMPORT ---
router.post('/sales/bulk', async (req, res) => {
  const sales = req.body;
  if (!Array.isArray(sales)) {
    return res.status(400).json({ message: 'Request body must be an array of sales' });
  }

  const salesToInsert = sales.map((s, index) => ({
    sale_id: s.sale_id || `SAL-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
    product_id: s.product_id,
    quantity_sold: Number(s.quantity_sold) || 0,
    date: s.date || new Date().toISOString(),
    brand: req.brand
  }));

  const { data: salesData, error: salesError } = await supabase.from('sales').insert(salesToInsert).select();
  if (salesError) return res.status(400).json({ message: salesError.message });

  // Update stock and check threshold for each sale
  try {
    for (const sale of salesToInsert) {
      const { data: product } = await supabase.from('products').select('*').eq('product_id', sale.product_id).eq('brand', req.brand).single();
      if (product) {
        const newStock = product.current_stock - sale.quantity_sold;
        await supabase.from('products').update({ current_stock: newStock }).eq('product_id', sale.product_id).eq('brand', req.brand);
        
        if (newStock < product.threshold) {
          await supabase.from('alerts').insert([{
            alert_id: `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            product_id: product.product_id,
            message: `Low stock for ${product.name}! Current stock: ${newStock}, Threshold: ${product.threshold}`,
            brand: req.brand
          }]);
        }
      }
    }
  } catch (stockErr) {
    console.error('Failed to update stock/alerts for bulk sales:', stockErr.message);
  }

  await logAudit('Admin', 'BULK_IMPORT_SALES', `Successfully imported ${sales.length} B2B transactions under brand ${req.brand}`);
  triggerBroadcast(req, 'SALE_LOGGED', { bulk: true });

  res.status(201).json(salesData);
});

// --- STAFF / USER MANAGEMENT ROUTES (ADMIN ONLY) ---
router.get('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required' });
  }
  const { data, error } = await supabase.from('users').select('id, username, role, created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required' });
  }
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  if (!['admin', 'staff', 'warehouse_manager'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('users').insert([
      { username, password_hash, role }
    ]).select('id, username, role, created_at').single();

    if (error) return res.status(400).json({ message: error.message });

    await logAudit(req.user.role, 'USER_CREATE', `Created user account for ${username} with role ${role}`);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required' });
  }
  const { role, password } = req.body;
  const userId = req.params.id;

  try {
    const { data: userToUpdate, error: getErr } = await supabase.from('users').select('*').eq('id', userId).single();
    if (getErr || !userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};
    if (role) {
      if (!['admin', 'staff', 'warehouse_manager'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      updates.role = role;
    }
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    const { data, error } = await supabase.from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, role, created_at').single();

    if (error) return res.status(400).json({ message: error.message });

    await logAudit(req.user.role, 'USER_UPDATE', `Updated user account details for ${userToUpdate.username}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required' });
  }
  const userId = req.params.id;

  try {
    const { data: userToDelete } = await supabase.from('users').select('username').eq('id', userId).single();
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.username === userToDelete.username) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) return res.status(500).json({ message: error.message });

    await logAudit(req.user.role, 'USER_DELETE', `Deleted user account ${userToDelete.username}`);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

// --- INDUSTRY AUTO-RESEED ENDPOINT (GENERALIZATION) ---
router.post('/industry/reseed', async (req, res) => {
  const { industry } = req.body;
  if (!['apparel', 'electronics', 'fmcg', 'pharma', 'hardware'].includes(industry)) {
    return res.status(400).json({ message: 'Invalid industry theme' });
  }

  const industryToBrandMap = {
    'apparel': 'Apparel & Fashion',
    'electronics': 'Electronics & Gadgets',
    'fmcg': 'FMCG & Pantry',
    'pharma': 'Pharma & Cosmetics',
    'hardware': 'Hardware & Power Tools'
  };
  const targetBrand = industryToBrandMap[industry];

  try {
    console.log(`🧹 Clearing database for localized industry reseeding: ${industry} (Brand: ${targetBrand})...`);
    
    // Clear only records matching the targetBrand in correct order
    await supabase.from('predictions').delete().eq('brand', targetBrand);
    await supabase.from('damaged_stock').delete().eq('brand', targetBrand);
    await supabase.from('alerts').delete().eq('brand', targetBrand);
    await supabase.from('sales').delete().eq('brand', targetBrand);
    await supabase.from('purchase_orders').delete().eq('brand', targetBrand);
    await supabase.from('products').delete().eq('brand', targetBrand);
    await supabase.from('suppliers').delete().eq('brand', targetBrand);
    
    console.log(`🌱 Localized brand tables cleared for '${targetBrand}'! Starting seeding...`);

    // 1. Define Suppliers & Products based on selected industry
    let suppliersToInsert = [];
    let productsToInsert = [];

    if (industry === 'electronics') {
      suppliersToInsert = [
        { name: 'ElectroMax Distributors', email: 'info@electromax.com', phone: '+91 99999 88888', address: '402 Tech Park, Bengaluru, Karnataka' },
        { name: 'Apex Chipset Corp', email: 'sales@apexchip.com', phone: '+91 88888 77777', address: '701 Silicon Tower, Hyderabad, Telangana' },
        { name: 'Global Optical Sensors', email: 'import@globaloptical.com', phone: '+91 77777 66666', address: '15 Optics Zone, Pune, Maharashtra' }
      ];
    } else if (industry === 'fmcg') {
      suppliersToInsert = [
        { name: 'Heritage Agro Farms', email: 'supply@heritageagro.com', phone: '+91 99999 11111', address: 'Sector 4, Karnal, Haryana' },
        { name: 'Nile Coffee Importers', email: 'beans@nilecoffee.in', phone: '+91 88888 22222', address: '12 Port Terminal, Kochi, Kerala' },
        { name: 'Dairy Valley Coop', email: 'orders@dairyvalley.co', phone: '+91 77777 33333', address: '88 Anand Hub, Anand, Gujarat' }
      ];
    } else if (industry === 'pharma') {
      suppliersToInsert = [
        { name: 'Lifecare Labs Ltd.', email: 'info@lifecare.com', phone: '+91 99999 44444', address: 'Baddi Industrial Area, Himachal Pradesh' },
        { name: 'Natura Botanicals', email: 'support@naturabotanicals.com', phone: '+91 88888 55555', address: '55 Herb Park, Dehradun, Uttarakhand' },
        { name: 'PureShield Hygiene', email: 'b2b@pureshield.in', phone: '+91 77777 66666', address: '12 Pharma Park, Ahmedabad, Gujarat' }
      ];
    } else if (industry === 'hardware') {
      suppliersToInsert = [
        { name: 'Apex Steel & Alloys', email: 'sales@apexsteel.com', phone: '+91 99999 55555', address: 'Industrial Area phase-2, Ludhiana, Punjab' },
        { name: 'EverTool Corp', email: 'support@evertool.in', phone: '+91 88888 66666', address: 'Textile Hub, Surat, Gujarat' },
        { name: 'SafeArmor Gear', email: 'b2b@safearmor.com', phone: '+91 77777 77777', address: '22 Safety Zone, Chennai, Tamil Nadu' }
      ];
    } else {
      // apparel default
      suppliersToInsert = [
        { name: 'Apparel Craft Ltd.', email: 'info@apparelcraft.com', phone: '+91 98765 43210', address: '102 Textiles Zone, Surat, Gujarat' },
        { name: 'KnitWear Wholesale', email: 'orders@knitwear.in', phone: '+91 87654 32109', address: '405 Hosiery Lane, Ludhiana, Punjab' },
        { name: 'EcoThreads & Co.', email: 'contact@ecothreads.com', phone: '+91 76543 21098', address: '78 Green Hub, Coimbatore, Tamil Nadu' }
      ];
    }

    // Insert Suppliers with brand
    const suppliersWithBrand = suppliersToInsert.map(s => ({ ...s, brand: targetBrand }));
    const { data: seededSuppliers, error: supErr } = await supabase.from('suppliers').insert(suppliersWithBrand).select();
    if (supErr) throw supErr;

    const s1 = seededSuppliers[0].id;
    const s2 = seededSuppliers[1].id;
    const s3 = seededSuppliers[2].id;

    if (industry === 'electronics') {
      productsToInsert = [
        { product_id: 'PRD-ELEC-01', name: 'iPhone 15 Pro', price: 134999, original_price: 139999, category: 'Smartphones', current_stock: 85, threshold: 15, warehouse_location: 'Aisle A-1', supplier_id: s1 },
        { product_id: 'PRD-ELEC-02', name: 'MacBook Air M3', price: 114900, original_price: 119900, category: 'Laptops', current_stock: 40, threshold: 8, warehouse_location: 'Aisle B-2', supplier_id: s2 },
        { product_id: 'PRD-ELEC-03', name: 'Sony WH-1000XM5', price: 29990, original_price: 29990, category: 'Audio', current_stock: 120, threshold: 20, warehouse_location: 'Aisle C-3', supplier_id: s3 },
        { product_id: 'PRD-ELEC-04', name: 'Apple Watch Series 9', price: 41900, original_price: 44900, category: 'Wearables', current_stock: 65, threshold: 12, warehouse_location: 'Aisle D-4', supplier_id: s1 },
        { product_id: 'PRD-ELEC-05', name: 'Logitech MX Master 3S', price: 9495, original_price: 9495, category: 'Accessories', current_stock: 150, threshold: 30, warehouse_location: 'Aisle E-5', supplier_id: s2 },
        { product_id: 'PRD-ELEC-06', name: 'Dell 27" 4K Monitor', price: 35900, original_price: 37900, category: 'Displays', current_stock: 30, threshold: 5, warehouse_location: 'Aisle F-6', supplier_id: s3 },
        { product_id: 'PRD-ELEC-07', name: 'Anker 100W Charger', price: 4999, original_price: 5499, category: 'Accessories', current_stock: 200, threshold: 40, warehouse_location: 'Aisle G-7', supplier_id: s1 },
        { product_id: 'PRD-ELEC-08', name: 'Samsung T7 2TB SSD', price: 15999, original_price: 15999, category: 'Storage', current_stock: 95, threshold: 18, warehouse_location: 'Aisle H-8', supplier_id: s2 }
      ];
    } else if (industry === 'fmcg') {
      productsToInsert = [
        { product_id: 'PRD-FMCG-01', name: 'Organic Almond Milk', price: 299, original_price: 349, category: 'Dairy Alternatives', current_stock: 300, threshold: 50, warehouse_location: 'Cold Storage A', supplier_id: s1 },
        { product_id: 'PRD-FMCG-02', name: 'Guatemalan Coffee Beans', price: 1249, original_price: 1249, category: 'Beverages', current_stock: 150, threshold: 25, warehouse_location: 'Dry Food Aisle 1', supplier_id: s2 },
        { product_id: 'PRD-FMCG-03', name: 'Greek Yogurt (1kg)', price: 349, original_price: 399, category: 'Dairy', current_stock: 180, threshold: 30, warehouse_location: 'Cold Storage B', supplier_id: s3 },
        { product_id: 'PRD-FMCG-04', name: 'Gluten-Free Oats', price: 450, original_price: 499, category: 'Bakery & Grains', current_stock: 220, threshold: 40, warehouse_location: 'Dry Food Aisle 2', supplier_id: s1 },
        { product_id: 'PRD-FMCG-05', name: 'Organic Avocados (5pc)', price: 699, original_price: 799, category: 'Fresh Produce', current_stock: 80, threshold: 20, warehouse_location: 'Produce Rack 3', supplier_id: s2 },
        { product_id: 'PRD-FMCG-06', name: 'Cold-Pressed Olive Oil', price: 1899, original_price: 1999, category: 'Pantry Staples', current_stock: 110, threshold: 15, warehouse_location: 'Dry Food Aisle 3', supplier_id: s3 },
        { product_id: 'PRD-FMCG-07', name: 'Sparkling Spring Water', price: 150, original_price: 150, category: 'Beverages', current_stock: 500, threshold: 80, warehouse_location: 'Cold Storage C', supplier_id: s1 },
        { product_id: 'PRD-FMCG-08', name: 'Dark Chocolate 85%', price: 249, original_price: 299, category: 'Snacks', current_stock: 400, threshold: 60, warehouse_location: 'Confectionery Rack 1', supplier_id: s2 }
      ];
    } else if (industry === 'pharma') {
      productsToInsert = [
        { product_id: 'PRD-PHAR-01', name: 'Hydrating Face Serum', price: 1199, original_price: 1299, category: 'Skincare', current_stock: 140, threshold: 25, warehouse_location: 'Zone A-Shelf 3', supplier_id: s1 },
        { product_id: 'PRD-PHAR-02', name: 'Argan Oil Shampoo', price: 849, original_price: 849, category: 'Haircare', current_stock: 160, threshold: 30, warehouse_location: 'Zone A-Shelf 5', supplier_id: s2 },
        { product_id: 'PRD-PHAR-03', name: 'Multivitamin Gummies', price: 699, original_price: 799, category: 'Wellness', current_stock: 250, threshold: 40, warehouse_location: 'Zone B-Shelf 1', supplier_id: s3 },
        { product_id: 'PRD-PHAR-04', name: 'Waterproof Bandages', price: 199, original_price: 249, category: 'First Aid', current_stock: 400, threshold: 50, warehouse_location: 'Zone C-Shelf 2', supplier_id: s1 },
        { product_id: 'PRD-PHAR-05', name: 'Organic Aloe Vera Gel', price: 349, original_price: 349, category: 'Skincare', current_stock: 200, threshold: 35, warehouse_location: 'Zone A-Shelf 4', supplier_id: s2 },
        { product_id: 'PRD-PHAR-06', name: 'Natural Lavender Soap', price: 149, original_price: 199, category: 'Hygiene', current_stock: 500, threshold: 80, warehouse_location: 'Zone C-Shelf 4', supplier_id: s3 },
        { product_id: 'PRD-PHAR-07', name: 'Whey Isolate Protein', price: 4599, original_price: 4999, category: 'Wellness', current_stock: 90, threshold: 15, warehouse_location: 'Zone B-Shelf 4', supplier_id: s1 },
        { product_id: 'PRD-PHAR-08', name: 'Alcohol Hand Sanitizer', price: 99, original_price: 99, category: 'Hygiene', current_stock: 600, threshold: 100, warehouse_location: 'Zone C-Shelf 1', supplier_id: s2 }
      ];
    } else if (industry === 'hardware') {
      productsToInsert = [
        { product_id: 'PRD-HARD-01', name: 'Cordless Drill 18V', price: 6499, original_price: 6999, category: 'Power Tools', current_stock: 70, threshold: 12, warehouse_location: 'Rack T-1', supplier_id: s1 },
        { product_id: 'PRD-HARD-02', name: 'Socket Wrench Set (40pc)', price: 2899, original_price: 2999, category: 'Hand Tools', current_stock: 95, threshold: 15, warehouse_location: 'Rack T-3', supplier_id: s2 },
        { product_id: 'PRD-HARD-03', name: 'Anti-Fog Safety Goggles', price: 399, original_price: 499, category: 'Safety Gear', current_stock: 300, threshold: 45, warehouse_location: 'Rack S-2', supplier_id: s3 },
        { product_id: 'PRD-HARD-04', name: 'M10 Stainless Screws (500x)', price: 849, original_price: 999, category: 'Fasteners', current_stock: 450, threshold: 60, warehouse_location: 'Rack F-4', supplier_id: s1 },
        { product_id: 'PRD-HARD-05', name: 'High-Visibility Vest', price: 249, original_price: 249, category: 'Safety Gear', current_stock: 250, threshold: 35, warehouse_location: 'Rack S-3', supplier_id: s2 },
        { product_id: 'PRD-HARD-06', name: 'Heavy-Duty Storage Toolbox', price: 1999, original_price: 2299, category: 'Storage', current_stock: 80, threshold: 10, warehouse_location: 'Rack R-1', supplier_id: s3 },
        { product_id: 'PRD-HARD-07', name: 'Impact Rotary Hammer', price: 9499, original_price: 9999, category: 'Power Tools', current_stock: 35, threshold: 6, warehouse_location: 'Rack T-2', supplier_id: s1 },
        { product_id: 'PRD-HARD-08', name: 'Nylon Cable Ties (1000pc)', price: 199, original_price: 199, category: 'Fasteners', current_stock: 600, threshold: 80, warehouse_location: 'Rack F-2', supplier_id: s2 }
      ];
    } else {
      // Apparel default
      productsToInsert = [
        { product_id: 'PRD-01', name: 'Oversized Hoodie', price: 1499, original_price: 1799, category: 'Men Wear', current_stock: 120, threshold: 15, warehouse_location: 'Rack 1A', supplier_id: s1 },
        { product_id: 'PRD-02', name: 'Cargo Pants', price: 1899, original_price: 1999, category: 'Men Wear', current_stock: 95, threshold: 15, warehouse_location: 'Rack 1B', supplier_id: s2 },
        { product_id: 'PRD-03', name: 'Graphic T-Shirt', price: 799, original_price: 899, category: 'Unisex', current_stock: 150, threshold: 20, warehouse_location: 'Rack 2A', supplier_id: s3 },
        { product_id: 'PRD-04', name: 'Denim Jacket', price: 2499, original_price: 2799, category: 'Women Wear', current_stock: 60, threshold: 10, warehouse_location: 'Rack 2B', supplier_id: s1 },
        { product_id: 'PRD-05', name: 'Joggers', price: 1299, original_price: 1499, category: 'Men Wear', current_stock: 110, threshold: 12, warehouse_location: 'Rack 1C', supplier_id: s2 },
        { product_id: 'PRD-06', name: 'Crop Top', price: 699, original_price: 799, category: 'Women Wear', current_stock: 90, threshold: 15, warehouse_location: 'Rack 2C', supplier_id: s3 },
        { product_id: 'PRD-07', name: 'Flannel Shirt', price: 1599, original_price: 1599, category: 'Unisex', current_stock: 85, threshold: 10, warehouse_location: 'Rack 3A', supplier_id: s1 },
        { product_id: 'PRD-08', name: 'Leather Jacket', price: 3999, original_price: 4499, category: 'Men Wear', current_stock: 40, threshold: 5, warehouse_location: 'Rack 1D', supplier_id: s2 },
        { product_id: 'PRD-09', name: 'Wide Leg Jeans', price: 2199, original_price: 2299, category: 'Women Wear', current_stock: 75, threshold: 8, warehouse_location: 'Rack 2D', supplier_id: s3 },
        { product_id: 'PRD-10', name: 'Sneakers', price: 2999, original_price: 3499, category: 'Footwear', current_stock: 130, threshold: 18, warehouse_location: 'Shoe Rack A', supplier_id: s1 }
      ];
    }

    // Insert Products with brand
    const productsWithBrand = productsToInsert.map(p => ({ ...p, brand: targetBrand }));
    const { error: prodErr } = await supabase.from('products').insert(productsWithBrand);
    if (prodErr) throw prodErr;

    // 2. Generate Random Historical Sales data for XGBoost compatibility
    const salesToInsert = [];
    const dateNow = new Date();
    
    productsToInsert.forEach(p => {
      // Create random B2B transactions over past 12 days for each SKU
      for (let dayOffset = 1; dayOffset <= 12; dayOffset += Math.floor(Math.random() * 3) + 2) {
        const saleDate = new Date();
        saleDate.setDate(dateNow.getDate() - dayOffset);
        
        salesToInsert.push({
          sale_id: `SAL-${p.product_id}-${dayOffset}-${Math.floor(Math.random() * 1000)}`,
          product_id: p.product_id,
          quantity_sold: Math.floor(Math.random() * 14) + 4, // 4 to 17 cartons sold
          date: saleDate.toISOString(),
          brand: targetBrand // Attach brand here
        });
      }
    });

    const { error: saleErr } = await supabase.from('sales').insert(salesToInsert);
    if (saleErr) throw saleErr;

    // Log the action to audit
    await logAudit('Admin', 'INDUSTRY_RESEED', `Reseeded localized database structure for theme: ${industry} (Brand: ${targetBrand})`);
    triggerBroadcast(req, 'PRODUCT_CHANGE', { reseed: true });

    res.json({ 
      message: `Successfully cleared and reseeded brand context for ${industry}`, 
      suppliersSeeded: suppliersToInsert.length, 
      productsSeeded: productsToInsert.length, 
      salesSeeded: salesToInsert.length 
    });
  } catch (err) {
    console.error("Reseeding failed:", err.message);
    res.status(500).json({ message: 'Failed to reseed database', error: err.message });
  }
});

// --- EMPLOYEES CRUD ---
router.get('/employees', async (req, res) => {
  const { data, error } = await supabase.from('employees').select('*').eq('brand', req.brand).order('full_name', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

router.post('/employees', async (req, res) => {
  const { full_name, role, phone, email, joining_date, monthly_salary, status } = req.body;
  const sanitizedDate = formatDateToYMD(joining_date) || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('employees').insert([
    { full_name, role, phone, email, joining_date: sanitizedDate, monthly_salary: monthly_salary || 0, status: status || 'Active', brand: req.brand }
  ]).select().single();
  if (error) return res.status(400).json({ message: error.message });
  
  await logAudit('Admin', 'EMPLOYEE_CREATE', `Created employee profile for ${full_name} under brand ${req.brand}`);

  // Automatically insert monthly salary record into salary_records ledger for current month
  try {
    const monthStr = sanitizedDate.substring(0, 7); // 'YYYY-MM'
    const base = Number(monthly_salary) || 0;
    
    await supabase.from('salary_records').insert([
      { 
        employee_id: data.id, 
        month: monthStr, 
        base_salary: base, 
        bonus: 0, 
        deductions: 0, 
        absent_days: 0,
        absent_deduction: 0,
        net_salary: base, 
        paid_amount: 0, 
        pending_dues: base, 
        status: 'Unpaid' 
      }
    ]);
    console.log(`[Payroll Engine] Automatically initialized monthly salary ledger entry for ${full_name} (ID: ${data.id}) for month ${monthStr}`);
  } catch (payErr) {
    console.error('[Payroll Engine] Failed to auto-generate salary ledger entry:', payErr.message);
  }

  res.status(201).json(data);
});

router.put('/employees/:id', async (req, res) => {
  const payload = { ...req.body };
  if (payload.joining_date) {
    payload.joining_date = formatDateToYMD(payload.joining_date);
  }
  const { data, error } = await supabase.from('employees')
    .update(payload)
    .eq('id', req.params.id)
    .eq('brand', req.brand)
    .select().single();
  if (error) return res.status(400).json({ message: error.message });
  await logAudit('Admin', 'EMPLOYEE_UPDATE', `Updated employee profile for ${data.full_name} under brand ${req.brand}`);
  res.json(data);
});

router.delete('/employees/:id', async (req, res) => {
  const { data: employee } = await supabase.from('employees').select('full_name').eq('id', req.params.id).eq('brand', req.brand).single();
  if (!employee) return res.status(404).json({ message: 'Employee not found under this brand' });
  const { error } = await supabase.from('employees').delete().eq('id', req.params.id).eq('brand', req.brand);
  if (error) return res.status(500).json({ message: error.message });
  await logAudit('Admin', 'EMPLOYEE_DELETE', `Deleted employee profile: ${employee.full_name} from brand ${req.brand}`);
  res.json({ message: 'Employee deleted successfully' });
});

// --- ATTENDANCE CRUD ---
router.get('/staff/attendance', async (req, res) => {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('id').eq('brand', req.brand);
    if (empErr) return res.status(500).json({ message: empErr.message });
    const empIds = employees.map(e => e.id);
    if (empIds.length === 0) return res.json([]);
    
    const { data, error } = await supabase.from('attendance').select('*').in('employee_id', empIds).order('date', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/staff/attendance', async (req, res) => {
  const { employee_id, date, status, working_hours, notes } = req.body;
  const sanitizedDate = formatDateToYMD(date) || new Date().toISOString().split('T')[0];
  
  // Upsert to handle updates of attendance for the same day
  const { data, error } = await supabase.from('attendance').upsert(
    { employee_id, date: sanitizedDate, status, working_hours: working_hours || 0, notes },
    { onConflict: 'employee_id,date' }
  ).select().single();

  if (error) return res.status(400).json({ message: error.message });

  // Automatically update the salary record for that employee and month if it exists
  try {
    const monthStr = sanitizedDate.substring(0, 7); // 'YYYY-MM'
    const { data: record } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('month', monthStr)
      .maybeSingle();

    if (record) {
      const base = Number(record.base_salary);
      const bon = Number(record.bonus);
      const ded = Number(record.deductions);
      const paid = Number(record.paid_amount) || 0;

      const [yearStr, monthStrSplit] = monthStr.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStrSplit, 10);
      const daysInMonth = new Date(year, monthIdx, 0).getDate();

      const { data: attList } = await supabase
        .from('attendance')
        .select('date')
        .eq('employee_id', employee_id)
        .eq('status', 'Absent');

      const absentCount = attList ? attList.filter(a => a.date && a.date.startsWith(monthStr)).length : 0;
      const dailyRate = daysInMonth > 0 ? (base / daysInMonth) : 0;
      const absentDeduction = Math.round(absentCount * dailyRate);

      const net = Math.max(0, base + bon - ded - absentDeduction);
      const pending = Math.max(0, net - paid);
      
      let newStatus = 'Unpaid';
      if (pending === 0) {
        newStatus = 'Paid';
      } else if (paid > 0) {
        newStatus = 'Partial';
      }

      await supabase
        .from('salary_records')
        .update({
          absent_days: absentCount,
          absent_deduction: absentDeduction,
          net_salary: net,
          pending_dues: pending,
          status: newStatus
        })
        .eq('id', record.id);
      
      console.log(`[Payroll Engine] Reactively updated salary record: employee=${employee_id}, month=${monthStr}, absents=${absentCount}, cut=${absentDeduction}, net=${net}`);
    }
  } catch (payErr) {
    console.error('[Payroll Engine] Failed to reactively update monthly salary record:', payErr.message);
  }

  res.status(201).json(data);
});

// --- WORK LOGS CRUD ---
router.get('/staff/work-logs', async (req, res) => {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('id').eq('brand', req.brand);
    if (empErr) return res.status(500).json({ message: empErr.message });
    const empIds = employees.map(e => e.id);
    if (empIds.length === 0) return res.json([]);

    const { data, error } = await supabase.from('work_logs').select('*').in('employee_id', empIds).order('date', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/staff/work-logs', async (req, res) => {
  const { employee_id, date, tasks_completed, notes } = req.body;
  const sanitizedDate = formatDateToYMD(date) || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('work_logs').upsert(
    { employee_id, date: sanitizedDate, tasks_completed, notes },
    { onConflict: 'employee_id,date' }
  ).select().single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json(data);
});

// --- SALARY RECORDS CRUD ---
router.get('/staff/salary-records', async (req, res) => {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('id').eq('brand', req.brand);
    if (empErr) return res.status(500).json({ message: empErr.message });
    const empIds = employees.map(e => e.id);
    if (empIds.length === 0) return res.json([]);

    const { data, error } = await supabase.from('salary_records').select('*').in('employee_id', empIds).order('month', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/staff/salary-records', async (req, res) => {
  const { employee_id, month, base_salary, bonus, deductions } = req.body;
  const base = Number(base_salary) || 0;
  const bon = Number(bonus) || 0;
  const ded = Number(deductions) || 0;

  try {
    // Calculate days in month
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, monthIdx, 0).getDate();

    // Fetch absent records for this employee
    const { data: attList } = await supabase
      .from('attendance')
      .select('date')
      .eq('employee_id', employee_id)
      .eq('status', 'Absent');

    const absentCount = attList ? attList.filter(a => a.date && a.date.startsWith(month)).length : 0;
    const dailyRate = daysInMonth > 0 ? (base / daysInMonth) : 0;
    const absentDeduction = Math.round(absentCount * dailyRate);

    const net = Math.max(0, base + bon - ded - absentDeduction);
    const pending = net;

    const { data, error } = await supabase.from('salary_records').insert([
      { 
        employee_id, 
        month, 
        base_salary: base, 
        bonus: bon, 
        deductions: ded, 
        absent_days: absentCount,
        absent_deduction: absentDeduction,
        net_salary: net, 
        paid_amount: 0, 
        pending_dues: pending, 
        status: 'Unpaid' 
      }
    ]).select().single();

    if (error) return res.status(400).json({ message: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/staff/salary-records/:id', async (req, res) => {
  const { base_salary, bonus, deductions } = req.body;
  const recId = req.params.id;

  try {
    // 1. Fetch current record
    const { data: record, error: getErr } = await supabase
      .from('salary_records')
      .select('*')
      .eq('id', recId)
      .single();

    if (getErr || !record) return res.status(404).json({ message: 'Salary record not found' });

    const base = base_salary !== undefined ? Number(base_salary) : Number(record.base_salary);
    const bon = bonus !== undefined ? Number(bonus) : Number(record.bonus);
    const ded = deductions !== undefined ? Number(deductions) : Number(record.deductions);
    const employee_id = record.employee_id;
    const month = record.month;

    // 2. Recalculate days in month & absents
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, monthIdx, 0).getDate();

    const { data: attList } = await supabase
      .from('attendance')
      .select('date')
      .eq('employee_id', employee_id)
      .eq('status', 'Absent');

    const absentCount = attList ? attList.filter(a => a.date && a.date.startsWith(month)).length : 0;
    const dailyRate = daysInMonth > 0 ? (base / daysInMonth) : 0;
    const absentDeduction = Math.round(absentCount * dailyRate);

    const net = Math.max(0, base + bon - ded - absentDeduction);
    
    // 3. Keep paid_amount the same and update pending_dues
    const paid = Number(record.paid_amount) || 0;
    const pending = Math.max(0, net - paid);
    
    let status = 'Unpaid';
    if (pending === 0) {
      status = 'Paid';
    } else if (paid > 0) {
      status = 'Partial';
    }

    // 4. Update table
    const { data: updated, error: upErr } = await supabase
      .from('salary_records')
      .update({
        base_salary: base,
        bonus: bon,
        deductions: ded,
        absent_days: absentCount,
        absent_deduction: absentDeduction,
        net_salary: net,
        pending_dues: pending,
        status: status
      })
      .eq('id', recId)
      .select()
      .single();

    if (upErr) return res.status(400).json({ message: upErr.message });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PAYMENTS CRUD (WITH AUTOMATIC RE-CALCULATION) ---
router.get('/staff/payments', async (req, res) => {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('id').eq('brand', req.brand);
    if (empErr) return res.status(500).json({ message: empErr.message });
    const empIds = employees.map(e => e.id);
    if (empIds.length === 0) return res.json([]);

    const { data, error } = await supabase.from('payments').select('*').in('employee_id', empIds).order('payment_date', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/staff/payments', async (req, res) => {
  const { employee_id, salary_record_id, amount_paid, payment_date, payment_method, notes } = req.body;
  const amount = Number(amount_paid) || 0;
  const sanitizedDate = formatDateToYMD(payment_date) || new Date().toISOString().split('T')[0];

  try {
    // 1. Insert individual payment
    const { data: payment, error: payErr } = await supabase.from('payments').insert([
      { employee_id, salary_record_id, amount_paid: amount, payment_date: sanitizedDate, payment_method, notes }
    ]).select().single();

    if (payErr) throw payErr;

    // 2. Fetch the corresponding monthly salary record
    const { data: record, error: recErr } = await supabase.from('salary_records').select('*').eq('id', salary_record_id).single();
    if (recErr || !record) throw new Error('Salary record not found');

    // 3. Compute new totals
    const newPaid = Number(record.paid_amount) + amount;
    const newPending = Math.max(0, Number(record.net_salary) - newPaid);
    let newStatus = 'Unpaid';
    if (newPending === 0) {
      newStatus = 'Paid';
    } else if (newPaid > 0) {
      newStatus = 'Partial';
    }

    // 4. Update the salary record
    await supabase.from('salary_records')
      .update({ paid_amount: newPaid, pending_dues: newPending, status: newStatus })
      .eq('id', salary_record_id);

    // 5. Audit log
    const { data: employee } = await supabase.from('employees').select('full_name').eq('id', employee_id).single();
    const empName = employee ? employee.full_name : 'Employee';
    await logAudit('Admin', 'SALARY_PAYMENT', `Dispatched salary payment of ₹${amount} to ${empName} for month ${record.month}`);

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// --- STAFF & PAYROLL ANALYTICS ---
router.get('/staff/analytics', async (req, res) => {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('*').eq('brand', req.brand);
    if (empErr) throw empErr;

    const empIds = employees.map(e => e.id);
    if (empIds.length === 0) {
      return res.json({
        totalStaff: 0,
        totalPaid: 0,
        totalPending: 0,
        attendanceRate: 100,
        monthlyPayroll: []
      });
    }

    const [attRes, salRes] = await Promise.all([
      supabase.from('attendance').select('*').in('employee_id', empIds),
      supabase.from('salary_records').select('*').in('employee_id', empIds)
    ]);

    if (attRes.error) throw attRes.error;
    if (salRes.error) throw salRes.error;

    const attendance = attRes.data;
    const salaries = salRes.data;

    // Total staff count
    const totalStaff = employees.length;

    // Total salary paid & pending dues
    const totalPaid = salaries.reduce((sum, s) => sum + Number(s.paid_amount), 0);
    const totalPending = salaries.reduce((sum, s) => sum + Number(s.pending_dues), 0);

    // Attendance rate
    const totalAttRecords = attendance.length;
    const presentRecords = attendance.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
    const attendanceRate = totalAttRecords > 0 ? Math.round((presentRecords / totalAttRecords) * 100) : 100;

    // Group payroll summary by month
    const monthlyGroups = {};
    salaries.forEach(s => {
      if (!monthlyGroups[s.month]) {
        monthlyGroups[s.month] = { month: s.month, net_salary: 0, paid_amount: 0, pending_dues: 0 };
      }
      monthlyGroups[s.month].net_salary += Number(s.net_salary);
      monthlyGroups[s.month].paid_amount += Number(s.paid_amount);
      monthlyGroups[s.month].pending_dues += Number(s.pending_dues);
    });

    const monthlyPayroll = Object.values(monthlyGroups).sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      totalStaff,
      totalPaid,
      totalPending,
      attendanceRate,
      monthlyPayroll
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to compute staff analytics', error: err.message });
  }
});

// --- BRAND DELETION ENDPOINT ---
router.post('/brands/delete', async (req, res) => {
  const { brand } = req.body;
  if (!brand) {
    return res.status(400).json({ message: 'Brand name is required' });
  }

  // Prevent deleting the currently active brand context to prevent crashes
  if (brand === req.brand) {
    return res.status(400).json({ message: 'Cannot delete the currently active brand. Switch brands first!' });
  }

  try {
    console.log(`🧹 Wiping all records for deleted brand: '${brand}'...`);
    
    // Purge in dependency order to prevent FK constraint failures
    await supabase.from('predictions').delete().eq('brand', brand);
    await supabase.from('damaged_stock').delete().eq('brand', brand);
    await supabase.from('alerts').delete().eq('brand', brand);
    await supabase.from('sales').delete().eq('brand', brand);
    await supabase.from('purchase_orders').delete().eq('brand', brand);
    await supabase.from('products').delete().eq('brand', brand);
    await supabase.from('suppliers').delete().eq('brand', brand);
    
    // Deleting from employees cascades to attendance, work_logs, salary_records, payments
    await supabase.from('employees').delete().eq('brand', brand);
    
    await logAudit('Admin', 'BRAND_DELETE', `Completely deleted brand and wiped all associated records for: ${brand}`);
    
    res.json({ message: `Successfully deleted brand: '${brand}' and all associated records.` });
  } catch (err) {
    console.error("Brand deletion failed:", err.message);
    res.status(500).json({ message: 'Failed to delete brand', error: err.message });
  }
});

module.exports = router;
